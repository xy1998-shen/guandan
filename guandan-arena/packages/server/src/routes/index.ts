import { Router } from 'express';
import agentRoutes from './agent.js';
import roomRoutes from './room.js';
import gameRoutes from './game.js';
import leaderboardRoutes from './leaderboard.js';
import matchmakingRoutes from './matchmaking.js';

const router = Router();

/**
 * 健康检查端点
 * GET /health
 */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
  });
});

// Agent 路由
router.use('/api/v1/agents', agentRoutes);

// Room 路由
router.use('/api/v1/rooms', roomRoutes);

// Game 路由
router.use('/api/v1/games', gameRoutes);

// Leaderboard 路由
router.use('/api/v1/leaderboard', leaderboardRoutes);

// Matchmaking 路由
router.use('/api/v1/matchmaking', matchmakingRoutes);

export default router;
