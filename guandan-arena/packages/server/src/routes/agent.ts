import { Router, Request, Response, NextFunction } from 'express';
import { registerAgent, getAgent, listAgentsByOwner } from '../services/agent.js';
import { db, schema } from '../db/index.js';
import { and, desc, eq } from 'drizzle-orm';
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

    const leader = await db
      .select({
        gamesPlayed: schema.leaderboard.gamesPlayed,
        gamesWon: schema.leaderboard.gamesWon,
        roundsPlayed: schema.leaderboard.roundsPlayed,
        roundsWon: schema.leaderboard.roundsWon,
        eloRating: schema.leaderboard.eloRating,
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

export default router;
