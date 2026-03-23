import { eq, and, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { rooms, roomSeats, games } from '../db/schema.js';
import { deleteRoom } from './room.js';

// 时间常量
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 每60秒执行一次

/**
 * 清理过期的等待中房间（超过30分钟）
 * @returns 删除的房间数量
 */
async function cleanupStaleWaitingRooms(): Promise<number> {
  const threshold = Date.now() - THIRTY_MINUTES_MS;
  
  // 查询所有超时的 waiting 房间
  const staleRooms = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.status, 'waiting'), lt(rooms.createdAt, threshold)));
  
  if (staleRooms.length === 0) {
    return 0;
  }
  
  // 删除每个房间的座位和房间记录
  for (const room of staleRooms) {
    await db.delete(roomSeats).where(eq(roomSeats.roomId, room.id));
    await db.delete(rooms).where(eq(rooms.id, room.id));
  }
  
  return staleRooms.length;
}

/**
 * 清理卡住的游戏房间（playing 状态超过2小时）
 * @returns 清理的房间数量
 */
async function cleanupStuckPlayingRooms(): Promise<number> {
  const threshold = Date.now() - TWO_HOURS_MS;
  
  // 按 games.startedAt 判断超时，避免把房间创建时间误当成开局时间
  const stuckGames = await db
    .select({ roomId: games.roomId })
    .from(games)
    .where(and(eq(games.status, 'playing'), lt(games.startedAt, threshold)));

  const stuckRoomIds = Array.from(new Set(stuckGames.map((g) => g.roomId)));
  
  if (stuckRoomIds.length === 0) {
    return 0;
  }
  
  // 更新状态为 finished 并级联清理
  for (const roomId of stuckRoomIds) {
    await db.update(rooms).set({ status: 'finished' }).where(eq(rooms.id, roomId));
    await deleteRoom(roomId);
  }
  
  return stuckRoomIds.length;
}

/**
 * 执行房间清理任务
 */
async function runCleanup(): Promise<void> {
  try {
    const deletedWaiting = await cleanupStaleWaitingRooms();
    const deletedPlaying = await cleanupStuckPlayingRooms();
    
    if (deletedWaiting > 0 || deletedPlaying > 0) {
      console.log(`Room cleaner: deleted ${deletedWaiting} stale waiting rooms, ${deletedPlaying} stuck playing rooms`);
    }
  } catch (error) {
    console.error('[RoomCleaner] Error during cleanup:', error);
  }
}

/**
 * 启动房间清理器
 * 每60秒执行一次清理任务
 */
export function startRoomCleaner(): void {
  console.log('[RoomCleaner] Room cleaner started (interval: 60s)');
  
  // 启动定时器
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);
}
