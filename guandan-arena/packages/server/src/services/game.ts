import crypto from 'crypto';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { games, rounds, plays } from '../db/schema.js';
import type { Card, Seat, Team, Rank } from '@guandan/shared';

/**
 * 升级变化信息
 */
export interface LevelChange {
  team: Team;
  from: Rank;
  to: Rank;
  levelUp: number;
}

/**
 * 获取游戏状态
 * @param gameId 游戏 ID
 * @returns 游戏信息或 null
 */
export async function getGameState(gameId: string): Promise<{
  id: string;
  roomId: string;
  status: string;
  teamALevel: string;
  teamBLevel: string;
  winner: string | null;
  startedAt: number;
  finishedAt: number | null;
} | null> {
  const result = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0];
}

/**
 * 获取出牌历史
 * @param gameId 游戏 ID
 * @returns 出牌记录数组
 */
export async function getGameHistory(gameId: string): Promise<{
  roundId: string;
  roundNumber: number;
  trumpRank: string;
  plays: {
    id: string;
    trickNumber: number;
    seat: number;
    comboType: string;
    cards: Card[];
    timestamp: number;
  }[];
}[]> {
  // 查询所有回合
  const roundsResult = await db
    .select()
    .from(rounds)
    .where(eq(rounds.gameId, gameId))
    .orderBy(asc(rounds.roundNumber));

  const history = [];

  for (const round of roundsResult) {
    // 查询该回合的所有出牌
    const playsResult = await db
      .select()
      .from(plays)
      .where(eq(plays.roundId, round.id))
      .orderBy(asc(plays.trickNumber), asc(plays.timestamp));

    const playRecords = playsResult.map((p) => ({
      id: p.id,
      trickNumber: p.trickNumber,
      seat: p.seat,
      comboType: p.comboType,
      cards: JSON.parse(p.cards) as Card[],
      timestamp: p.timestamp,
    }));

    history.push({
      roundId: round.id,
      roundNumber: round.roundNumber,
      trumpRank: round.trumpRank,
      plays: playRecords,
    });
  }

  return history;
}

/**
 * 更新游戏状态
 * @param gameId 游戏 ID
 * @param status 状态
 * @param winner 获胜队伍（可选）
 */
export async function updateGameStatus(
  gameId: string,
  status: string,
  winner?: Team,
  teamALevel?: Rank,
  teamBLevel?: Rank
): Promise<void> {
  const updateData: Record<string, unknown> = { status };

  if (winner) {
    updateData.winner = winner;
    updateData.finishedAt = Date.now();
  }

  if (teamALevel) {
    updateData.teamALevel = teamALevel;
  }

  if (teamBLevel) {
    updateData.teamBLevel = teamBLevel;
  }

  await db.update(games).set(updateData).where(eq(games.id, gameId));
}

/**
 * 记录一局结果
 * @param gameId 游戏 ID
 * @param roundNumber 回合编号
 * @param trumpRank 级牌
 * @param finishOrder 出完顺序
 * @param levelChange 升级信息
 * @returns roundId
 */
export async function saveRound(
  gameId: string,
  roundNumber: number,
  trumpRank: string,
  finishOrder: Seat[],
  levelChange?: LevelChange
): Promise<string> {
  const roundId = crypto.randomUUID();

  await db.insert(rounds).values({
    id: roundId,
    gameId,
    roundNumber,
    trumpRank,
    finishOrder: JSON.stringify(finishOrder),
    levelChange: levelChange ? JSON.stringify(levelChange) : null,
  });

  return roundId;
}

/**
 * 更新 round 记录（补充 finishOrder 和 levelChange）
 * @param roundId 回合 ID
 * @param finishOrder 出完顺序
 * @param levelChange 升级信息
 */
export async function updateRound(
  roundId: string,
  finishOrder: Seat[],
  levelChange?: LevelChange
): Promise<void> {
  await db
    .update(rounds)
    .set({
      finishOrder: JSON.stringify(finishOrder),
      levelChange: levelChange ? JSON.stringify(levelChange) : null,
    })
    .where(eq(rounds.id, roundId));
}

/**
 * 出牌记录的额外参数
 */
export interface SavePlayOptions {
  responseTimeMs?: number; // Agent 出牌响应时间（毫秒）
  handCountBefore?: number; // 出牌前手牌数量
  isAutoPlay?: boolean; // 是否自动出牌（掉线/超时）
  isLeading?: boolean; // 是否为首出
}

/**
 * 记录出牌
 * @param roundId 回合 ID
 * @param trickNumber Trick 编号
 * @param seat 座位号
 * @param comboType 牌型
 * @param cards 牌
 * @param options 额外参数
 * @returns playId
 */
export async function savePlay(
  roundId: string,
  trickNumber: number,
  seat: number,
  comboType: string,
  cards: Card[],
  options?: SavePlayOptions
): Promise<string> {
  const playId = crypto.randomUUID();

  await db.insert(plays).values({
    id: playId,
    roundId,
    trickNumber,
    seat,
    comboType,
    cards: JSON.stringify(cards),
    timestamp: Date.now(),
    responseTimeMs: options?.responseTimeMs ?? null,
    handCountBefore: options?.handCountBefore ?? null,
    isAutoPlay: options?.isAutoPlay ? 1 : 0,
    isLeading: options?.isLeading ? 1 : 0,
    trickWinner: 0, // 默认为0，待 trick 结束后更新
  });

  return playId;
}

/**
 * 更新 trick winner 标记
 * @param playId 出牌记录 ID
 */
export async function updateTrickWinner(playId: string): Promise<void> {
  await db
    .update(plays)
    .set({ trickWinner: 1 })
    .where(eq(plays.id, playId));
}

/**
 * 获取某局游戏某个座位的所有出牌记录
 * @param gameId 游戏 ID
 * @param seat 座位号
 */
export async function getPlaysForSeatInGame(
  gameId: string,
  seat: number
): Promise<{
  id: string;
  comboType: string;
  responseTimeMs: number | null;
  handCountBefore: number | null;
  isLeading: number | null;
  trickWinner: number | null;
}[]> {
  // 先获取该游戏的所有 round
  const roundsResult = await db
    .select({ id: rounds.id })
    .from(rounds)
    .where(eq(rounds.gameId, gameId));

  if (roundsResult.length === 0) {
    return [];
  }

  const result: {
    id: string;
    comboType: string;
    responseTimeMs: number | null;
    handCountBefore: number | null;
    isLeading: number | null;
    trickWinner: number | null;
  }[] = [];

  // 查询每个 round 中该座位的出牌记录
  for (const round of roundsResult) {
    const playsResult = await db
      .select({
        id: plays.id,
        comboType: plays.comboType,
        responseTimeMs: plays.responseTimeMs,
        handCountBefore: plays.handCountBefore,
        isLeading: plays.isLeading,
        trickWinner: plays.trickWinner,
        seat: plays.seat,
      })
      .from(plays)
      .where(eq(plays.roundId, round.id));

    for (const play of playsResult) {
      if (play.seat === seat) {
        result.push({
          id: play.id,
          comboType: play.comboType,
          responseTimeMs: play.responseTimeMs,
          handCountBefore: play.handCountBefore,
          isLeading: play.isLeading,
          trickWinner: play.trickWinner,
        });
      }
    }
  }

  return result;
}
