import { Router, Request, Response, NextFunction } from 'express';
import { createRoom, getRooms, getRoom, joinRoom } from '../services/room.js';
import { getAgent } from '../services/agent.js';
import { AppError } from '../middleware/error.js';
import { authMiddleware } from '../middleware/auth.js';
import { scheduleRoomAutoStart } from '../services/auto-start.js';
import type { ApiResponse, RoomSeat } from '@guandan/shared';

const router = Router();

/**
 * 自动匹配加入响应
 */
interface MatchmakingJoinResponse extends RoomSeat {
  roomId: string;
  roomName: string;
  currentPlayers: number;
}

/**
 * POST /api/v1/matchmaking/join
 * 自动匹配加入房间
 * Agent 只需调用一次，平台自动完成整个匹配流程
 */
router.post('/join', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId } = req.body;

    // 1. 校验 agentId 非空
    if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
      throw new AppError('agentId is required and must be a non-empty string', 400);
    }

    const trimmedAgentId = agentId.trim();
    if (!req.agent || req.agent.id !== trimmedAgentId) {
      throw new AppError('agentId must match authenticated agent', 403);
    }

    // 2. 验证 Agent 存在
    const agent = await getAgent(trimmedAgentId);
    if (!agent) {
      throw new AppError('Agent not found', 400);
    }

    // 3. 查找可用房间 (waiting 状态且座位 < 4)
    const allRooms = await getRooms();
    const availableRoom = allRooms.find(
      (room) => room.status === 'waiting' && room.seats.length < 4
    );

    let targetRoomId: string;
    let targetRoomName: string;

    if (availableRoom) {
      // 找到可用房间
      targetRoomId = availableRoom.id;
      targetRoomName = availableRoom.name;
      console.log(`[Matchmaking] Found available room: ${targetRoomId} (${targetRoomName})`);
    } else {
      // 没有可用房间，自动创建一个
      const timestamp = Date.now();
      const autoRoomName = `Auto-Match-${timestamp}`;
      const newRoom = await createRoom(autoRoomName);
      targetRoomId = newRoom.id;
      targetRoomName = newRoom.name;
      console.log(`[Matchmaking] No available room, created: ${targetRoomId} (${targetRoomName})`);
    }

    // 4. 加入房间（joinRoom 内部会检查跨房间冲突）
    const roomSeat = await joinRoom(targetRoomId, trimmedAgentId);

    // 5. 获取加入后的房间信息
    const updatedRoom = await getRoom(targetRoomId);
    const currentPlayers = updatedRoom?.seats.length ?? 0;

    // 6. 检查是否满员4人，延迟5秒后自动开始游戏
    if (updatedRoom && updatedRoom.seats.length === 4 && updatedRoom.status === 'waiting') {
      scheduleRoomAutoStart(targetRoomId, 'Matchmaking');
    }

    // 7. 返回结果
    const response: ApiResponse<MatchmakingJoinResponse> = {
      success: true,
      data: {
        roomId: targetRoomId,
        roomName: targetRoomName,
        currentPlayers,
        seat: roomSeat.seat,
        agentId: roomSeat.agentId,
        agentName: roomSeat.agentName,
        team: roomSeat.team,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    // 将 service 层的错误转换为 HTTP 错误
    if (error instanceof Error) {
      switch (error.message) {
        case 'AGENT_NOT_FOUND':
          return next(new AppError('Agent not found', 400));
        case 'AGENT_ALREADY_IN_GAME':
          return next(new AppError('Agent is already in an active room', 400));
        case 'AGENT_ALREADY_IN_ROOM':
          return next(new AppError('Agent is already in the room', 400));
        case 'ROOM_FULL':
          return next(new AppError('Room is full', 400));
      }
    }
    next(error);
  }
});

export default router;
