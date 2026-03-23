import type { PlayerInfo } from '../game-loop/coordinator.js';
import { coordinator } from '../game-loop/coordinator.js';
import { getAgent } from './agent.js';
import { getRoom, startGame } from './room.js';

const AUTO_START_DELAY_MS = 5000;
const pendingAutoStarts = new Set<string>();

/**
 * 满员房间自动开始（带去重，避免并发重复启动）
 */
export function scheduleRoomAutoStart(roomId: string, source: 'Room' | 'Matchmaking'): void {
  if (pendingAutoStarts.has(roomId)) {
    console.log(`[${source}] Room ${roomId} auto-start already scheduled, skip duplicate schedule`);
    return;
  }

  pendingAutoStarts.add(roomId);
  console.log(`[${source}] Room ${roomId} is full (4 players), game will auto-start in 5 seconds...`);

  setTimeout(async () => {
    try {
      // 再次检查房间状态，防止重复启动或状态变化
      const currentRoom = await getRoom(roomId);
      if (!currentRoom || currentRoom.status !== 'waiting' || currentRoom.seats.length < 4) {
        console.log(`[${source}] Room ${roomId} status changed, skip auto-start`);
        return;
      }

      console.log(`[${source}] Auto-starting game for room ${roomId}...`);
      const result = await startGame(roomId);

      // 构建玩家信息，用于启动游戏协调器
      const players: PlayerInfo[] = [];
      for (const seat of currentRoom.seats) {
        const agent = await getAgent(seat.agentId);
        if (agent) {
          players.push({
            seat: seat.seat,
            agentId: seat.agentId,
            agentName: seat.agentName,
            team: seat.team,
            callbackUrl: agent.callbackUrl,
          });
        }
      }

      coordinator.startGame(roomId, result.gameId, players).catch((error) => {
        console.error(`[${source}] Failed to auto-start game coordinator for room ${roomId}:`, error);
      });

      console.log(`[${source}] Game ${result.gameId} auto-started for room ${roomId}`);
    } catch (error) {
      // 并发情况下房间可能已被其他请求启动，属于预期可忽略
      if (error instanceof Error && error.message === 'ROOM_NOT_WAITING') {
        console.log(`[${source}] Room ${roomId} already started by another request`);
        return;
      }
      console.error(`[${source}] Auto-start game failed for room ${roomId}:`, error);
    } finally {
      pendingAutoStarts.delete(roomId);
    }
  }, AUTO_START_DELAY_MS);
}
