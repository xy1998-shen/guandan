import crypto from 'crypto';
import { eq, ne, and, inArray, desc, max } from 'drizzle-orm';
import { db } from '../db/index.js';
import { rooms, roomSeats, agents, games, rounds, plays } from '../db/schema.js';
import type { Room, RoomSeat, RoomConfig, RoomStatus, Seat, Team } from '@guandan/shared';

/**
 * 座位到队伍的映射
 * seat 0,2 = Team A; seat 1,3 = Team B
 */
function getTeamBySeat(seat: Seat): Team {
  return seat === 0 || seat === 2 ? 'A' : 'B';
}

/**
 * 获取可用座位列表
 */
function getAvailableSeats(occupiedSeats: number[]): Seat[] {
  const allSeats: Seat[] = [0, 1, 2, 3];
  return allSeats.filter((s) => !occupiedSeats.includes(s));
}

/**
 * 查询房间及其座位信息
 */
async function queryRoomWithSeats(roomId: string): Promise<Room | null> {
  // 查询房间基本信息
  const roomResult = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (roomResult.length === 0) {
    return null;
  }

  const room = roomResult[0];

  // 查询座位信息
  const seatsResult = await db
    .select({
      seat: roomSeats.seat,
      agentId: roomSeats.agentId,
      team: roomSeats.team,
      agentName: agents.name,
    })
    .from(roomSeats)
    .innerJoin(agents, eq(roomSeats.agentId, agents.id))
    .where(eq(roomSeats.roomId, roomId));

  const seats: RoomSeat[] = seatsResult.map((s) => ({
    seat: s.seat as Seat,
    agentId: s.agentId,
    agentName: s.agentName,
    team: s.team as Team,
  }));

  // 进行中房间附带当前局数与双方级数
  let currentRound: number | undefined;
  let teamALevel: string | undefined;
  let teamBLevel: string | undefined;
  if (room.status === 'playing') {
    const gameResult = await db
      .select({
        id: games.id,
        teamALevel: games.teamALevel,
        teamBLevel: games.teamBLevel,
      })
      .from(games)
      .where(and(eq(games.roomId, roomId), eq(games.status, 'playing')))
      .orderBy(desc(games.startedAt))
      .limit(1);

    const activeGame = gameResult[0];
    if (activeGame) {
      const roundResult = await db
        .select({ maxRound: max(rounds.roundNumber) })
        .from(rounds)
        .where(eq(rounds.gameId, activeGame.id));
      currentRound = roundResult[0]?.maxRound ?? 1;
      teamALevel = activeGame.teamALevel;
      teamBLevel = activeGame.teamBLevel;
    }
  }

  return {
    id: room.id,
    name: room.name,
    status: room.status as RoomStatus,
    seats,
    createdAt: room.createdAt,
    config: room.config ? JSON.parse(room.config) : undefined,
    currentRound,
    teamALevel,
    teamBLevel,
  };
}

/**
 * 创建房间
 * @param name 房间名称
 * @param config 房间配置
 * @returns Room 对象
 */
export async function createRoom(name: string, config?: RoomConfig): Promise<Room> {
  const roomId = crypto.randomUUID();
  const createdAt = Date.now();

  await db.insert(rooms).values({
    id: roomId,
    name,
    status: 'waiting',
    createdAt,
    config: config ? JSON.stringify(config) : null,
  });

  return {
    id: roomId,
    name,
    status: 'waiting',
    seats: [],
    createdAt,
    config,
  };
}

/**
 * 获取所有房间列表（过滤掉已结束的房间）
 * @returns Room 数组
 */
export async function getRooms(): Promise<Room[]> {
  // 查询所有非 finished 状态的房间
  const roomsResult = await db.select().from(rooms).where(ne(rooms.status, 'finished'));

  // 获取每个房间的座位信息
  const result: Room[] = [];
  for (const room of roomsResult) {
    const seatsResult = await db
      .select({
        seat: roomSeats.seat,
        agentId: roomSeats.agentId,
        team: roomSeats.team,
        agentName: agents.name,
      })
      .from(roomSeats)
      .innerJoin(agents, eq(roomSeats.agentId, agents.id))
      .where(eq(roomSeats.roomId, room.id));

    const seats: RoomSeat[] = seatsResult.map((s) => ({
      seat: s.seat as Seat,
      agentId: s.agentId,
      agentName: s.agentName,
      team: s.team as Team,
    }));

    let currentRound: number | undefined;
    let teamALevel: string | undefined;
    let teamBLevel: string | undefined;
    if (room.status === 'playing') {
      const gameResult = await db
        .select({
          id: games.id,
          teamALevel: games.teamALevel,
          teamBLevel: games.teamBLevel,
        })
        .from(games)
        .where(and(eq(games.roomId, room.id), eq(games.status, 'playing')))
        .orderBy(desc(games.startedAt))
        .limit(1);

      const activeGame = gameResult[0];
      if (activeGame) {
        const roundResult = await db
          .select({ maxRound: max(rounds.roundNumber) })
          .from(rounds)
          .where(eq(rounds.gameId, activeGame.id));
        currentRound = roundResult[0]?.maxRound ?? 1;
        teamALevel = activeGame.teamALevel;
        teamBLevel = activeGame.teamBLevel;
      }
    }

    result.push({
      id: room.id,
      name: room.name,
      status: room.status as RoomStatus,
      seats,
      createdAt: room.createdAt,
      config: room.config ? JSON.parse(room.config) : undefined,
      currentRound,
      teamALevel,
      teamBLevel,
    });
  }

  return result;
}

/**
 * 获取单个房间详情
 * @param roomId 房间 ID
 * @returns Room 或 null
 */
export async function getRoom(roomId: string): Promise<Room | null> {
  return queryRoomWithSeats(roomId);
}

/**
 * 加入房间
 * @param roomId 房间 ID
 * @param agentId Agent ID
 * @param seat 可选的座位号
 * @param team 可选的队伍
 * @returns RoomSeat 对象
 */
export async function joinRoom(
  roomId: string,
  agentId: string,
  seat?: Seat,
  team?: Team
): Promise<RoomSeat> {
  // 校验房间存在且 status='waiting'
  const roomResult = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (roomResult.length === 0) {
    throw new Error('ROOM_NOT_FOUND');
  }

  const room = roomResult[0];
  if (room.status !== 'waiting') {
    throw new Error('ROOM_NOT_WAITING');
  }

  // 校验 Agent 存在
  const agentResult = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (agentResult.length === 0) {
    throw new Error('AGENT_NOT_FOUND');
  }

  const agent = agentResult[0];

  // 检查 Agent 是否已在房间中
  const existingSeat = await db
    .select()
    .from(roomSeats)
    .where(eq(roomSeats.roomId, roomId));

  const agentAlreadyInRoom = existingSeat.find((s) => s.agentId === agentId);
  if (agentAlreadyInRoom) {
    throw new Error('AGENT_ALREADY_IN_ROOM');
  }

  // 检查 Agent 是否已在其他活跃房间中（跨房间检查）
  const activeRooms = await db.select()
    .from(roomSeats)
    .innerJoin(rooms, eq(roomSeats.roomId, rooms.id))
    .where(and(
      eq(roomSeats.agentId, agentId),
      inArray(rooms.status, ['waiting', 'playing'])
    ));
  if (activeRooms.length > 0) {
    throw new Error('AGENT_ALREADY_IN_GAME');
  }

  const occupiedSeats = existingSeat.map((s) => s.seat);
  let finalSeat: Seat;
  let finalTeam: Team;

  if (seat !== undefined) {
    // 校验指定座位是否空闲
    if (occupiedSeats.includes(seat)) {
      throw new Error('SEAT_OCCUPIED');
    }
    finalSeat = seat;
    // 如果指定了队伍，校验座位和队伍的一致性
    const expectedTeam = getTeamBySeat(seat);
    if (team && team !== expectedTeam) {
      throw new Error('SEAT_TEAM_MISMATCH');
    }
    finalTeam = expectedTeam;
  } else {
    // 自动分配空闲座位
    const availableSeats = getAvailableSeats(occupiedSeats);
    if (availableSeats.length === 0) {
      throw new Error('ROOM_FULL');
    }

    if (team) {
      // 如果指定了队伍，优先选择该队伍的座位
      const teamSeats = availableSeats.filter((s) => getTeamBySeat(s) === team);
      if (teamSeats.length === 0) {
        throw new Error('TEAM_FULL');
      }
      finalSeat = teamSeats[0];
    } else {
      // 否则取第一个可用座位
      finalSeat = availableSeats[0];
    }
    finalTeam = getTeamBySeat(finalSeat);
  }

  // 插入 room_seats 表
  await db.insert(roomSeats).values({
    roomId,
    seat: finalSeat,
    agentId,
    team: finalTeam,
  });

  return {
    seat: finalSeat,
    agentId,
    agentName: agent.name,
    team: finalTeam,
  };
}

/**
 * 开始游戏
 * @param roomId 房间 ID
 * @returns gameId
 */
export async function startGame(roomId: string): Promise<{ gameId: string }> {
  // 校验房间存在且 status='waiting'
  const roomResult = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (roomResult.length === 0) {
    throw new Error('ROOM_NOT_FOUND');
  }

  const room = roomResult[0];
  if (room.status !== 'waiting') {
    throw new Error('ROOM_NOT_WAITING');
  }

  // 校验4个座位都已满
  const seatsResult = await db
    .select()
    .from(roomSeats)
    .where(eq(roomSeats.roomId, roomId));

  if (seatsResult.length < 4) {
    throw new Error('NOT_ENOUGH_PLAYERS');
  }

  // 更新房间 status='playing'
  await db.update(rooms).set({ status: 'playing' }).where(eq(rooms.id, roomId));

  // 创建新游戏记录
  const gameId = crypto.randomUUID();
  const startedAt = Date.now();

  await db.insert(games).values({
    id: gameId,
    roomId,
    status: 'playing',
    teamALevel: '2',
    teamBLevel: '2',
    winner: null,
    startedAt,
    finishedAt: null,
  });

  return { gameId };
}

/**
 * 更新房间状态
 * @param roomId 房间 ID
 * @param status 新状态
 */
export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  await db.update(rooms).set({ status }).where(eq(rooms.id, roomId));
  console.log(`[Room] Room ${roomId} status updated to ${status}`);
}

/**
 * 删除房间（游戏结束后清理）
 * @param roomId 房间 ID
 */
export async function deleteRoom(roomId: string): Promise<void> {
  // 先查出该房间的 games
  const roomGames = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.roomId, roomId));

  const gameIds = roomGames.map((g) => g.id);
  if (gameIds.length > 0) {
    // 查出这些 games 对应的 rounds
    const gameRounds = await db
      .select({ id: rounds.id })
      .from(rounds)
      .where(inArray(rounds.gameId, gameIds));

    const roundIds = gameRounds.map((r) => r.id);
    if (roundIds.length > 0) {
      // 先删 plays
      await db.delete(plays).where(inArray(plays.roundId, roundIds));
      // 再删 rounds
      await db.delete(rounds).where(inArray(rounds.id, roundIds));
    }

    // 再删 games
    await db.delete(games).where(inArray(games.id, gameIds));
  }

  // 先删除座位记录（外键约束）
  await db.delete(roomSeats).where(eq(roomSeats.roomId, roomId));
  
  // 再删除房间记录
  await db.delete(rooms).where(eq(rooms.id, roomId));
  
  console.log(`[Room] Room ${roomId} deleted from database`);
}
