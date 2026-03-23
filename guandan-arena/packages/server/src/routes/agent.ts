import { Router, Request, Response, NextFunction } from 'express';
import { registerAgent, getAgent, listAgentsByOwner, pauseAgent, resumeAgent, getAgentActiveRoom, getAgentByToken } from '../services/agent.js';
import { coordinator } from '../game-loop/coordinator.js';
import { authMiddleware } from '../middleware/auth.js';
import { db, schema } from '../db/index.js';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { AppError } from '../middleware/error.js';
import type { ApiResponse, RegisterAgentRequest, RegisterAgentResponse } from '@guandan/shared';

const router = Router();

function isValidCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/v1/agents/register
 * 注册新的 Agent
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as RegisterAgentRequest;

    // 校验 name 非空
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      throw new AppError('name is required and must be a non-empty string', 400);
    }

    // 校验 callbackUrl 非空
    if (!body.callbackUrl || typeof body.callbackUrl !== 'string' || body.callbackUrl.trim() === '') {
      throw new AppError('callbackUrl is required and must be a non-empty string', 400);
    }
    if (!isValidCallbackUrl(body.callbackUrl.trim())) {
      throw new AppError('callbackUrl must be a valid http/https URL', 400);
    }

    let ownerId: string | undefined;
    if (body.ownerId !== undefined) {
      if (typeof body.ownerId !== 'string') {
        throw new AppError('ownerId must be a string', 400);
      }
      const trimmedOwnerId = body.ownerId.trim();
      ownerId = trimmedOwnerId.length > 0 ? trimmedOwnerId : undefined;
    }

    const result = await registerAgent(body.name.trim(), body.callbackUrl.trim(), ownerId);

    const response: ApiResponse<RegisterAgentResponse> = {
      success: true,
      data: {
        agentId: result.agentId,
        apiToken: result.apiToken,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents?ownerId=xxx
 * 按 ownerId 查询 Agent 列表
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.query.ownerId;

    if (typeof ownerId !== 'string' || ownerId.trim() === '') {
      throw new AppError('ownerId is required', 400);
    }

    const agents = await listAgentsByOwner(ownerId.trim());
    const response: ApiResponse<Array<{ id: string; name: string; createdAt: number }>> = {
      success: true,
      data: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        createdAt: agent.createdAt,
      })),
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents/:id/stats
 * 获取 Agent 统计信息
 */
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agent = await getAgent(id);
    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    // 查询 leaderboard 表获取基础统计（包含新增字段）
    const leader = await db
      .select({
        gamesPlayed: schema.leaderboard.gamesPlayed,
        gamesWon: schema.leaderboard.gamesWon,
        roundsPlayed: schema.leaderboard.roundsPlayed,
        roundsWon: schema.leaderboard.roundsWon,
        eloRating: schema.leaderboard.eloRating,
        // 新增统计字段
        avgResponseTimeMs: schema.leaderboard.avgResponseTimeMs,
        bombTotal: schema.leaderboard.bombTotal,
        bombSuccess: schema.leaderboard.bombSuccess,
        riskScore: schema.leaderboard.riskScore,
      })
      .from(schema.leaderboard)
      .where(eq(schema.leaderboard.agentId, id))
      .limit(1);

    const gameRows = await db
      .select({
        gameId: schema.games.id,
        winner: schema.games.winner,
        finishedAt: schema.games.finishedAt,
        team: schema.roomSeats.team,
      })
      .from(schema.games)
      .innerJoin(
        schema.roomSeats,
        and(eq(schema.roomSeats.roomId, schema.games.roomId), eq(schema.roomSeats.agentId, id))
      )
      .where(eq(schema.games.status, 'finished'))
      .orderBy(desc(schema.games.finishedAt));

    const eloTrend = gameRows.slice(0, 20).reverse().reduce<number[]>((acc, row) => {
      const prev = acc.length > 0 ? acc[acc.length - 1] : 1000;
      const delta = row.winner === row.team ? 16 : -16;
      acc.push(prev + delta);
      return acc;
    }, []);

    const opponentRows = await db
      .select({
        gameId: schema.games.id,
        selfTeam: schema.roomSeats.team,
      })
      .from(schema.games)
      .innerJoin(
        schema.roomSeats,
        and(eq(schema.roomSeats.roomId, schema.games.roomId), eq(schema.roomSeats.agentId, id))
      )
      .where(eq(schema.games.status, 'finished'));

    const opponentMap = new Map<string, { games: number; wins: number }>();
    for (const row of opponentRows) {
      const players = await db
        .select({
          agentId: schema.roomSeats.agentId,
          agentName: schema.agents.name,
          team: schema.roomSeats.team,
          winner: schema.games.winner,
        })
        .from(schema.games)
        .innerJoin(schema.roomSeats, eq(schema.roomSeats.roomId, schema.games.roomId))
        .innerJoin(schema.agents, eq(schema.agents.id, schema.roomSeats.agentId))
        .where(eq(schema.games.id, row.gameId));

      for (const player of players) {
        if (player.agentId === id || player.team === row.selfTeam) continue;
        const current = opponentMap.get(player.agentName) || { games: 0, wins: 0 };
        current.games += 1;
        if (player.winner === row.selfTeam) current.wins += 1;
        opponentMap.set(player.agentName, current);
      }
    }

    // === 新增统计维度 ===

    // A. 牌型偏好分布 (comboTypeDistribution)
    // 查询该 Agent 所有出牌记录，按 combo_type 分组统计
    const comboTypeRows = await db
      .select({
        comboType: schema.plays.comboType,
        count: sql<number>`count(*)`,
      })
      .from(schema.plays)
      .innerJoin(schema.rounds, eq(schema.plays.roundId, schema.rounds.id))
      .innerJoin(schema.games, eq(schema.rounds.gameId, schema.games.id))
      .innerJoin(
        schema.roomSeats,
        sql`${schema.roomSeats.roomId} = ${schema.games.roomId} AND ${schema.roomSeats.seat} = ${schema.plays.seat}`
      )
      .where(
        and(
          eq(schema.roomSeats.agentId, id),
          eq(schema.games.status, 'finished'),
          ne(schema.plays.comboType, 'PASS')
        )
      )
      .groupBy(schema.plays.comboType)
      .orderBy(desc(sql<number>`count(*)`));

    const totalPlays = comboTypeRows.reduce((sum, row) => sum + Number(row.count), 0);
    const comboTypeDistribution = comboTypeRows.map((row) => ({
      comboType: row.comboType,
      count: Number(row.count),
      percentage: totalPlays > 0 ? Number(row.count) / totalPlays : 0,
    }));

    // B. 炸弹命中率 (bombStats)
    const bombTotal = leader[0]?.bombTotal ?? 0;
    const bombSuccess = leader[0]?.bombSuccess ?? 0;
    const bombStats = {
      bombTotal,
      bombSuccess,
      bombSuccessRate: bombTotal > 0 ? bombSuccess / bombTotal : 0,
    };

    // C. 队友配合胜率 (teammateStats)
    const teammateRows = await db
      .select({
        teammateId: schema.teammateStats.teammateId,
        teammateName: schema.agents.name,
        gamesPlayed: schema.teammateStats.gamesPlayed,
        gamesWon: schema.teammateStats.gamesWon,
        winRate: schema.teammateStats.winRate,
      })
      .from(schema.teammateStats)
      .innerJoin(schema.agents, eq(schema.agents.id, schema.teammateStats.teammateId))
      .where(eq(schema.teammateStats.agentId, id));

    const teammateStats = teammateRows.map((row) => ({
      teammate: row.teammateId,
      teammateName: row.teammateName,
      gamesPlayed: row.gamesPlayed ?? 0,
      gamesWon: row.gamesWon ?? 0,
      winRate: row.winRate ?? 0,
    }));

    // D. 出牌响应时间 (responseTimeStats)
    // 从 plays 表动态计算详细响应时间统计
    const responseTimeRows = await db
      .select({
        responseTimeMs: schema.plays.responseTimeMs,
      })
      .from(schema.plays)
      .innerJoin(schema.rounds, eq(schema.plays.roundId, schema.rounds.id))
      .innerJoin(schema.games, eq(schema.rounds.gameId, schema.games.id))
      .innerJoin(
        schema.roomSeats,
        sql`${schema.roomSeats.roomId} = ${schema.games.roomId} AND ${schema.roomSeats.seat} = ${schema.plays.seat}`
      )
      .where(
        and(
          eq(schema.roomSeats.agentId, id),
          eq(schema.games.status, 'finished')
        )
      );

    const validResponseTimes = responseTimeRows
      .map((r) => r.responseTimeMs)
      .filter((t): t is number => t !== null && t > 0);

    const responseTimeStats = {
      avgResponseTimeMs: leader[0]?.avgResponseTimeMs ?? 0,
      minResponseTimeMs: validResponseTimes.length > 0 ? Math.min(...validResponseTimes) : 0,
      maxResponseTimeMs: validResponseTimes.length > 0 ? Math.max(...validResponseTimes) : 0,
      totalPlays: validResponseTimes.length,
    };

    // E. 风险偏好评分 (riskScore)
    const riskScore = leader[0]?.riskScore ?? 0;

    const response: ApiResponse<{
      agentId: string;
      agentName: string;
      eloScore: number;
      gamesPlayed: number;
      gamesWon: number;
      winRate: number;
      roundsPlayed: number;
      roundsWon: number;
      roundWinRate: number;
      eloTrend: number[];
      opponents: Array<{ opponent: string; games: number; wins: number; winRate: number }>;
      // 新增统计维度
      comboTypeDistribution: Array<{ comboType: string; count: number; percentage: number }>;
      bombStats: { bombTotal: number; bombSuccess: number; bombSuccessRate: number };
      teammateStats: Array<{ teammate: string; teammateName: string; gamesPlayed: number; gamesWon: number; winRate: number }>;
      responseTimeStats: { avgResponseTimeMs: number; minResponseTimeMs: number; maxResponseTimeMs: number; totalPlays: number };
      riskScore: number;
    }> = {
      success: true,
      data: {
        agentId: id,
        agentName: agent.name,
        eloScore: leader[0]?.eloRating ?? 1000,
        gamesPlayed: leader[0]?.gamesPlayed ?? 0,
        gamesWon: leader[0]?.gamesWon ?? 0,
        winRate: (leader[0]?.gamesPlayed ?? 0) > 0 ? (leader[0]!.gamesWon / leader[0]!.gamesPlayed) : 0,
        roundsPlayed: leader[0]?.roundsPlayed ?? 0,
        roundsWon: leader[0]?.roundsWon ?? 0,
        roundWinRate: (leader[0]?.roundsPlayed ?? 0) > 0 ? (leader[0]!.roundsWon / leader[0]!.roundsPlayed) : 0,
        eloTrend,
        opponents: Array.from(opponentMap.entries()).map(([opponent, value]) => ({
          opponent,
          games: value.games,
          wins: value.wins,
          winRate: value.games > 0 ? value.wins / value.games : 0,
        })),
        // 新增统计维度
        comboTypeDistribution,
        bombStats,
        teammateStats,
        responseTimeStats,
        riskScore,
      },
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents/:id/games
 * 获取 Agent 历史对局
 */
router.get('/:id/games', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const agent = await getAgent(id);
    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    const rows = await db
      .select({
        gameId: schema.games.id,
        roomId: schema.games.roomId,
        winner: schema.games.winner,
        teamALevel: schema.games.teamALevel,
        teamBLevel: schema.games.teamBLevel,
        startedAt: schema.games.startedAt,
        finishedAt: schema.games.finishedAt,
        selfTeam: schema.roomSeats.team,
      })
      .from(schema.games)
      .innerJoin(
        schema.roomSeats,
        and(eq(schema.roomSeats.roomId, schema.games.roomId), eq(schema.roomSeats.agentId, id))
      )
      .where(eq(schema.games.status, 'finished'))
      .orderBy(desc(schema.games.finishedAt))
      .limit(limit);

    const data = [];
    for (const row of rows) {
      const players = await db
        .select({
          agentId: schema.roomSeats.agentId,
          agentName: schema.agents.name,
          team: schema.roomSeats.team,
        })
        .from(schema.roomSeats)
        .innerJoin(schema.agents, eq(schema.agents.id, schema.roomSeats.agentId))
        .where(eq(schema.roomSeats.roomId, row.roomId));

      data.push({
        gameId: row.gameId,
        winner: row.winner,
        selfTeam: row.selfTeam,
        result: row.winner === row.selfTeam ? 'win' : 'lose',
        teamALevel: row.teamALevel,
        teamBLevel: row.teamBLevel,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        players,
      });
    }

    const response: ApiResponse<typeof data> = {
      success: true,
      data,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents/:id
 * 获取 Agent 信息（不返回 apiToken）
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const agent = await getAgent(id);

    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    // 不返回 apiToken
    const response: ApiResponse<{
      id: string;
      name: string;
      callbackUrl: string;
      createdAt: number;
      active: boolean;
      ownerId?: string;
    }> = {
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        callbackUrl: agent.callbackUrl,
        createdAt: agent.createdAt,
        active: agent.active,
        ownerId: agent.ownerId,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/agents/:id/pause
 * 暂停 Agent（设置 active=0，如果在游戏中则等当前 round 结束后弃权）
 */
router.post('/:id/pause', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 验证认证的 agent 与请求的 id 匹配
    if (!req.agent || req.agent.id !== id) {
      throw new AppError('Agent ID must match authenticated agent', 403);
    }

    // 验证 agent 存在且 active=1
    const agent = await getAgent(id);
    if (!agent) {
      throw new AppError('Agent not found', 404);
    }
    if (!agent.active) {
      throw new AppError('Agent is already paused', 400);
    }

    // 检查 agent 是否在进行中的游戏中
    const activeRoomId = await getAgentActiveRoom(id);

    if (activeRoomId) {
      // 在游戏中：调用 GameCoordinator 的 requestQuit 方法标记退出意图
      coordinator.requestQuit(activeRoomId, id);
      // 设置 active=0
      await pauseAgent(id);

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Agent paused. Will exit after current round.' },
      };
      res.json(response);
    } else {
      // 不在游戏中：直接设置 active=0
      await pauseAgent(id);

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'Agent paused immediately.' },
      };
      res.json(response);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/agents/:id/resume
 * 恢复 Agent（设置 active=1）
 * 注意：由于 authMiddleware 会拒绝 inactive agent，这里需要手动验证 token
 */
router.post('/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 手动验证 token（因为 authMiddleware 会拒绝 inactive agent）
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid Authorization header', 401);
    }
    const token = authHeader.slice(7);
    if (!token || !token.startsWith('gd_')) {
      throw new AppError('Invalid token format', 401);
    }

    // 根据 token 查询 agent
    const tokenAgent = await getAgentByToken(token);
    if (!tokenAgent) {
      throw new AppError('Invalid or expired token', 401);
    }

    // 验证认证的 agent 与请求的 id 匹配
    if (tokenAgent.id !== id) {
      throw new AppError('Agent ID must match authenticated agent', 403);
    }

    // 验证 agent 存在
    const agent = await getAgent(id);
    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    // 设置 active=1
    await resumeAgent(id);

    // 清除 GameCoordinator 中可能残留的 pendingQuit 标记
    // 由于我们不知道 agent 可能在哪个房间，需要先查询
    const activeRoomId = await getAgentActiveRoom(id);
    if (activeRoomId) {
      coordinator.clearQuit(activeRoomId);
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Agent resumed.' },
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
