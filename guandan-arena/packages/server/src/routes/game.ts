import { Router, Request, Response, NextFunction } from 'express';
import { getGameState, getGameHistory } from '../services/game.js';
import { db, schema } from '../db/index.js';
import { desc, eq } from 'drizzle-orm';
import { AppError } from '../middleware/error.js';
import type { ApiResponse } from '@guandan/shared';

const router = Router();

/**
 * GET /api/v1/games/recent
 * 获取最近已完成对局
 */
router.get('/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit || 10), 50);
    const games = await db
      .select({
        gameId: schema.games.id,
        roomId: schema.games.roomId,
        winner: schema.games.winner,
        teamALevel: schema.games.teamALevel,
        teamBLevel: schema.games.teamBLevel,
        startedAt: schema.games.startedAt,
        finishedAt: schema.games.finishedAt,
      })
      .from(schema.games)
      .where(eq(schema.games.status, 'finished'))
      .orderBy(desc(schema.games.finishedAt))
      .limit(limit);

    const result = [];
    for (const game of games) {
      const players = await db
        .select({
          seat: schema.roomSeats.seat,
          team: schema.roomSeats.team,
          agentId: schema.roomSeats.agentId,
          agentName: schema.agents.name,
        })
        .from(schema.roomSeats)
        .innerJoin(schema.agents, eq(schema.agents.id, schema.roomSeats.agentId))
        .where(eq(schema.roomSeats.roomId, game.roomId));

      result.push({
        ...game,
        players,
      });
    }

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/games/:id/state
 * 获取游戏状态
 */
router.get('/:id/state', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const gameState = await getGameState(id);

    if (!gameState) {
      throw new AppError('Game not found', 404);
    }

    const response: ApiResponse<typeof gameState> = {
      success: true,
      data: gameState,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/games/:id/history
 * 获取出牌历史
 */
router.get('/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 先检查游戏是否存在
    const gameState = await getGameState(id);
    if (!gameState) {
      throw new AppError('Game not found', 404);
    }

    const history = await getGameHistory(id);

    const response: ApiResponse<typeof history> = {
      success: true,
      data: history,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
