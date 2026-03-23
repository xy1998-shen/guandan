import { Router, Request, Response, NextFunction } from 'express';
import { db, schema } from '../db/index.js';
import { desc, eq, gte, sql } from 'drizzle-orm';
import type { ApiResponse } from '@guandan/shared';

const router = Router();

/**
 * 排行榜条目类型
 */
interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  eloScore: number;
  roundsPlayed: number;
  roundsWon: number;
  roundWinRate: number;
  bombRate: number;
  avgPlayIntervalMs: number;
  // 新增统计字段
  avgResponseTimeMs: number;
  bombSuccessRate: number;
  riskScore: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  todayGames: number;
}

/**
 * GET /api/v1/leaderboard
 * 获取按 ELO 排名的 Agent 列表
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    ).getTime();

    // 查询 leaderboard 表并关联 agents 表获取 agentName
    const results = await db
      .select({
        agentId: schema.leaderboard.agentId,
        agentName: schema.agents.name,
        gamesPlayed: schema.leaderboard.gamesPlayed,
        gamesWon: schema.leaderboard.gamesWon,
        roundsPlayed: schema.leaderboard.roundsPlayed,
        roundsWon: schema.leaderboard.roundsWon,
        winRate: schema.leaderboard.winRate,
        eloRating: schema.leaderboard.eloRating,
        // 新增统计字段
        avgResponseTimeMs: schema.leaderboard.avgResponseTimeMs,
        bombTotal: schema.leaderboard.bombTotal,
        bombSuccess: schema.leaderboard.bombSuccess,
        riskScore: schema.leaderboard.riskScore,
      })
      .from(schema.leaderboard)
      .innerJoin(schema.agents, eq(schema.leaderboard.agentId, schema.agents.id))
      .orderBy(desc(schema.leaderboard.eloRating));

    // 查询今日对局数（按 games.startedAt 统计）
    const todayGameResult = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(schema.games)
      .where(gte(schema.games.startedAt, dayStart));

    const playStats = await db
      .select({
        agentId: schema.roomSeats.agentId,
        comboType: schema.plays.comboType,
        timestamp: schema.plays.timestamp,
      })
      .from(schema.plays)
      .innerJoin(schema.rounds, eq(schema.plays.roundId, schema.rounds.id))
      .innerJoin(schema.games, eq(schema.rounds.gameId, schema.games.id))
      .innerJoin(
        schema.roomSeats,
        sql`${schema.roomSeats.roomId} = ${schema.games.roomId} AND ${schema.roomSeats.seat} = ${schema.plays.seat}`
      )
      .where(eq(schema.games.status, 'finished'));

    const bombs = new Set(['BOMB_4', 'BOMB_5', 'BOMB_6', 'BOMB_7', 'BOMB_8', 'STRAIGHT_FLUSH', 'ROCKET']);
    const playAgg = new Map<string, {
      total: number;
      bomb: number;
      lastTimestamp: number | null;
      intervalSum: number;
      intervalCount: number;
    }>();

    for (const item of playStats) {
      const current = playAgg.get(item.agentId) || {
        total: 0,
        bomb: 0,
        lastTimestamp: null,
        intervalSum: 0,
        intervalCount: 0,
      };
      current.total += 1;
      if (bombs.has(item.comboType)) {
        current.bomb += 1;
      }
      if (current.lastTimestamp !== null && item.timestamp >= current.lastTimestamp) {
        current.intervalSum += item.timestamp - current.lastTimestamp;
        current.intervalCount += 1;
      }
      current.lastTimestamp = item.timestamp;
      playAgg.set(item.agentId, current);
    }

    // 转换为前端期望的格式，并添加排名与扩展统计
    const entries: LeaderboardEntry[] = results.map((row, index) => {
      const stat = playAgg.get(row.agentId);
      const roundWinRate = row.roundsPlayed > 0 ? row.roundsWon / row.roundsPlayed : 0;
      const bombRate = stat && stat.total > 0 ? stat.bomb / stat.total : 0;
      const avgPlayIntervalMs = stat && stat.intervalCount > 0
        ? Math.round(stat.intervalSum / stat.intervalCount)
        : 0;

      // 计算炸弹成功率
      const bombTotal = row.bombTotal ?? 0;
      const bombSuccess = row.bombSuccess ?? 0;
      const bombSuccessRate = bombTotal > 0 ? bombSuccess / bombTotal : 0;

      return {
        rank: index + 1,
        agentId: row.agentId,
        agentName: row.agentName,
        gamesPlayed: row.gamesPlayed,
        wins: row.gamesWon,
        winRate: row.winRate,
        eloScore: row.eloRating,
        roundsPlayed: row.roundsPlayed,
        roundsWon: row.roundsWon,
        roundWinRate,
        bombRate,
        avgPlayIntervalMs,
        // 新增统计字段
        avgResponseTimeMs: row.avgResponseTimeMs ?? 0,
        bombSuccessRate,
        riskScore: row.riskScore ?? 0,
      };
    });

    const response: ApiResponse<LeaderboardResponse> = {
      success: true,
      data: {
        entries,
        todayGames: Number(todayGameResult[0]?.count ?? 0),
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
