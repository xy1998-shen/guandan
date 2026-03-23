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
 * 记录出牌
 * @param roundId 回合 ID
 * @param trickNumber Trick 编号
 * @param seat 座位号
 * @param comboType 牌型
 * @param cards 牌
 */
export async function savePlay(
  roundId: string,
  trickNumber: number,
  seat: number,
  comboType: string,
  cards: Card[]
): Promise<void> {
  const playId = crypto.randomUUID();

  await db.insert(plays).values({
    id: playId,
    roundId,
    trickNumber,
    seat,
    comboType,
    cards: JSON.stringify(cards),
    timestamp: Date.now(),
  });
}
