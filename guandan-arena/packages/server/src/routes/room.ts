import { Router, Request, Response, NextFunction } from 'express';
import { createRoom, getRooms, getRoom, joinRoom, startGame, deleteRoom } from '../services/room.js';
import { getAgent, listActiveAgents } from '../services/agent.js';
import { coordinator, type PlayerInfo } from '../game-loop/coordinator.js';
import { AppError } from '../middleware/error.js';
import { authMiddleware } from '../middleware/auth.js';
import { scheduleRoomAutoStart } from '../services/auto-start.js';
import type { ApiResponse, CreateRoomRequest, JoinRoomRequest, Room, RoomSeat, Seat, Team } from '@guandan/shared';

const router = Router();

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * POST /api/v1/rooms
 * 创建房间
 */
router.post('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as CreateRoomRequest;

    // 校验 name 非空
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      throw new AppError('name is required and must be a non-empty string', 400);
    }

    const room = await createRoom(body.name.trim(), body.config);

    const response: ApiResponse<Room> = {
      success: true,
      data: room,
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/rooms
 * 房间列表
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rooms = await getRooms();

    const response: ApiResponse<Room[]> = {
      success: true,
      data: rooms,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rooms/quick-start
 * 一键快速开局（随机 4 个已注册 Agent）
 */
router.post('/quick-start', async (_req: Request, res: Response, next: NextFunction) => {
  let createdRoomId: string | null = null;
  try {
    const activeAgents = shuffle(await listActiveAgents());
    if (activeAgents.length < 4) {
      throw new AppError('Not enough active agents (need at least 4)', 400);
    }

    const room = await createRoom(`快速对局-${Date.now()}`);
    createdRoomId = room.id;
    const selected = activeAgents.slice(0, 4);

    for (const agent of selected) {
      await joinRoom(room.id, agent.id);
    }

    const startResult = await startGame(room.id);

    const joinedRoom = await getRoom(room.id);
    if (!joinedRoom) {
      throw new AppError('Room not found after quick start', 500);
    }

    const players: PlayerInfo[] = [];
    for (const seat of joinedRoom.seats) {
      const agent = await getAgent(seat.agentId);
      if (!agent) {
        throw new AppError(`Agent ${seat.agentId} not found`, 400);
      }
      players.push({
        seat: seat.seat,
        agentId: seat.agentId,
        agentName: seat.agentName,
        team: seat.team,
        callbackUrl: agent.callbackUrl,
      });
    }

    coordinator.startGame(room.id, startResult.gameId, players).catch((error) => {
      console.error(`[Room] Failed to start quick-start coordinator for room ${room.id}:`, error);
    });

    const response: ApiResponse<{ roomId: string; gameId: string }> = {
      success: true,
      data: {
        roomId: room.id,
        gameId: startResult.gameId,
      },
    };
    res.status(201).json(response);
  } catch (error) {
    if (createdRoomId) {
      try {
        await deleteRoom(createdRoomId);
      } catch {
        // 清理失败不覆盖原始错误
      }
    }
    if (error instanceof Error) {
      switch (error.message) {
        case 'AGENT_ALREADY_IN_GAME':
          return next(new AppError('Some agents are already in active rooms, please retry', 400));
        case 'ROOM_NOT_WAITING':
          return next(new AppError('Room is not in waiting status', 400));
        case 'NOT_ENOUGH_PLAYERS':
          return next(new AppError('Room must have 4 players to start', 400));
      }
    }
    next(error);
  }
});

/**
 * GET /api/v1/rooms/:id
 * 房间详情
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const room = await getRoom(id);

    if (!room) {
      throw new AppError('Room not found', 404);
    }

    const response: ApiResponse<Room> = {
      success: true,
      data: room,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rooms/:id/join
 * 加入房间
 */
router.post('/:id/join', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body as JoinRoomRequest;

    // 校验 agentId 非空
    if (!body.agentId || typeof body.agentId !== 'string' || body.agentId.trim() === '') {
      throw new AppError('agentId is required and must be a non-empty string', 400);
    }
    if (!req.agent || req.agent.id !== body.agentId.trim()) {
      throw new AppError('agentId must match authenticated agent', 403);
    }

    // 校验 seat 如果提供了必须是 0-3
    if (body.seat !== undefined) {
      if (typeof body.seat !== 'number' || ![0, 1, 2, 3].includes(body.seat)) {
        throw new AppError('seat must be a number between 0 and 3', 400);
      }
    }

    // 校验 team 如果提供了必须是 'A' 或 'B'
    if (body.team !== undefined) {
      if (body.team !== 'A' && body.team !== 'B') {
        throw new AppError('team must be "A" or "B"', 400);
      }
    }

    const roomSeat = await joinRoom(
      id,
      body.agentId.trim(),
      body.seat as Seat | undefined,
      body.team as Team | undefined
    );

    // 检查是否满员4人，延迟5秒后自动开始游戏
    const room = await getRoom(id);
    if (room && room.seats.length === 4 && room.status === 'waiting') {
      scheduleRoomAutoStart(id, 'Room');
    }

    const response: ApiResponse<RoomSeat> = {
      success: true,
      data: roomSeat,
    };

    res.status(200).json(response);
  } catch (error) {
    // 将 service 层的错误转换为 HTTP 错误
    if (error instanceof Error) {
      switch (error.message) {
        case 'ROOM_NOT_FOUND':
          return next(new AppError('Room not found', 404));
        case 'ROOM_NOT_WAITING':
          return next(new AppError('Room is not in waiting status', 400));
        case 'AGENT_NOT_FOUND':
          return next(new AppError('Agent not found', 400));
        case 'AGENT_ALREADY_IN_ROOM':
          return next(new AppError('Agent is already in the room', 400));
        case 'SEAT_OCCUPIED':
          return next(new AppError('Seat is already occupied', 400));
        case 'SEAT_TEAM_MISMATCH':
          return next(new AppError('Seat does not belong to the specified team', 400));
        case 'ROOM_FULL':
          return next(new AppError('Room is full', 400));
        case 'TEAM_FULL':
          return next(new AppError('The specified team is full', 400));
      }
    }
    next(error);
  }
});

/**
 * POST /api/v1/rooms/:id/start
 * 开始游戏
 */
router.post('/:id/start', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 先获取房间信息，用于构建玩家信息
    const room = await getRoom(id);
    if (!room) {
      throw new AppError('Room not found', 404);
    }

    const result = await startGame(id);

    // 构建玩家信息，用于启动游戏协调器
    const players: PlayerInfo[] = [];
    for (const seat of room.seats) {
      const agent = await getAgent(seat.agentId);
      if (!agent) {
        throw new AppError(`Agent ${seat.agentId} not found`, 400);
      }
      players.push({
        seat: seat.seat,
        agentId: seat.agentId,
        agentName: seat.agentName,
        team: seat.team,
        callbackUrl: agent.callbackUrl,
      });
    }

    // Fire-and-forget: 启动游戏循环（不等待完成，但捕获启动阶段的错误）
    coordinator.startGame(id, result.gameId, players).catch((error) => {
      console.error(`[Room] Failed to start game coordinator for room ${id}:`, error);
    });

    const response: ApiResponse<{ gameId: string }> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  } catch (error) {
    // 将 service 层的错误转换为 HTTP 错误
    if (error instanceof Error) {
      switch (error.message) {
        case 'ROOM_NOT_FOUND':
          return next(new AppError('Room not found', 404));
        case 'ROOM_NOT_WAITING':
          return next(new AppError('Room is not in waiting status', 400));
        case 'NOT_ENOUGH_PLAYERS':
          return next(new AppError('Room must have 4 players to start', 400));
      }
    }
    next(error);
  }
});

/**
 * DELETE /api/v1/rooms/:id
 * 删除房间（仅限 waiting 状态）
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 查询房间状态
    const room = await getRoom(id);

    if (!room) {
      throw new AppError('Room not found', 404);
    }

    // 只允许删除 waiting 状态的房间
    if (room.status !== 'waiting') {
      throw new AppError('Can only delete rooms in waiting status', 400);
    }

    // 删除房间
    await deleteRoom(id);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Room deleted' },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
