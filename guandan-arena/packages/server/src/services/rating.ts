import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { leaderboard } from '../db/schema.js';
import type { Team } from '@guandan/shared';

/**
 * ELO 评分系统配置
 */
const DEFAULT_K_FACTOR = 32;
const DEFAULT_ELO = 1000;

/**
 * 游戏结果信息
 */
export interface GameResult {
  /** 获胜队伍 */
  winningTeam: Team;
  /** Team A 的 Agent ID 列表 */
  teamAAgentIds: string[];
  /** Team B 的 Agent ID 列表 */
  teamBAgentIds: string[];
}

/**
 * 回合结果信息
 */
export interface RoundResult {
  /** 所有参与该回合的 Agent ID 列表 */
  participantAgentIds: string[];
  /** 赢得该回合的 Agent ID 列表（获胜队伍的两个 Agent） */
  winnerAgentIds: string[];
}

/**
 * Agent 的排行榜数据
 */
interface LeaderboardData {
  agentId: string;
  gamesPlayed: number;
  gamesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  winRate: number;
  eloRating: number;
}

/**
 * 计算期望胜率
 * EA = 1 / (1 + 10^((RB - RA) / 400))
 * @param ratingA 选手 A 的 ELO 分数
 * @param ratingB 选手 B（对手）的 ELO 分数
 * @returns 选手 A 对选手 B 的期望胜率 (0-1)
 */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * 计算新的 ELO 分数
 * RA_new = RA_old + K * (SA - EA)
 * @param currentRating 当前 ELO 分数
 * @param expectedScore 期望胜率
 * @param actualScore 实际结果（赢=1，输=0）
 * @param kFactor K 系数，默认 32
 * @returns 新的 ELO 分数
 */
export function calculateNewElo(
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = DEFAULT_K_FACTOR
): number {
  const newRating = currentRating + kFactor * (actualScore - expectedScore);
  // 确保 ELO 不会为负数
  return Math.max(0, Math.round(newRating));
}

/**
 * 计算团队平均 ELO
 * @param ratings 团队成员的 ELO 数组
 * @returns 平均 ELO
 */
export function calculateTeamAverageElo(ratings: number[]): number {
  if (ratings.length === 0) return DEFAULT_ELO;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

/**
 * 为 2v2 团队赛计算新的 ELO 分数
 * - 获胜队伍的对手参考 ELO = 失败队伍的平均 ELO
 * - 失败队伍的对手参考 ELO = 获胜队伍的平均 ELO
 * @param winnersRatings 获胜队伍各成员的当前 ELO
 * @param losersRatings 失败队伍各成员的当前 ELO
 * @param kFactor K 系数
 * @returns 新的 ELO 分数 { winnersNewRatings, losersNewRatings }
 */
export function calculateTeamElo(
  winnersRatings: number[],
  losersRatings: number[],
  kFactor: number = DEFAULT_K_FACTOR
): { winnersNewRatings: number[]; losersNewRatings: number[] } {
  // 计算团队平均 ELO
  const winnersAvgElo = calculateTeamAverageElo(winnersRatings);
  const losersAvgElo = calculateTeamAverageElo(losersRatings);

  // 获胜队伍的新 ELO（对手参考 ELO = 失败队伍平均 ELO）
  const winnersNewRatings = winnersRatings.map((rating) => {
    const expectedScore = calculateExpectedScore(rating, losersAvgElo);
    return calculateNewElo(rating, expectedScore, 1, kFactor); // SA = 1 (win)
  });

  // 失败队伍的新 ELO（对手参考 ELO = 获胜队伍平均 ELO）
  const losersNewRatings = losersRatings.map((rating) => {
    const expectedScore = calculateExpectedScore(rating, winnersAvgElo);
    return calculateNewElo(rating, expectedScore, 0, kFactor); // SA = 0 (lose)
  });

  return { winnersNewRatings, losersNewRatings };
}

/**
 * 获取多个 Agent 的排行榜数据
 * @param agentIds Agent ID 列表
 * @returns Agent ID 到排行榜数据的映射
 */
async function getLeaderboardData(agentIds: string[]): Promise<Map<string, LeaderboardData>> {
  const results = await db
    .select()
    .from(leaderboard)
    .where(inArray(leaderboard.agentId, agentIds));

  const dataMap = new Map<string, LeaderboardData>();
  for (const row of results) {
    dataMap.set(row.agentId, {
      agentId: row.agentId,
      gamesPlayed: row.gamesPlayed,
      gamesWon: row.gamesWon,
      roundsPlayed: row.roundsPlayed,
      roundsWon: row.roundsWon,
      winRate: row.winRate,
      eloRating: row.eloRating,
    });
  }

  return dataMap;
}

/**
 * 根据游戏结果更新排行榜（包括 ELO 计算）
 * 使用事务确保一致性
 * @param gameResult 游戏结果
 * @param kFactor K 系数，默认 32
 */
export async function updateLeaderboardAfterGame(
  gameResult: GameResult,
  kFactor: number = DEFAULT_K_FACTOR
): Promise<void> {
  const { winningTeam, teamAAgentIds, teamBAgentIds } = gameResult;

  // 确定获胜和失败的队伍
  const winnerAgentIds = winningTeam === 'A' ? teamAAgentIds : teamBAgentIds;
  const loserAgentIds = winningTeam === 'A' ? teamBAgentIds : teamAAgentIds;

  // 所有参与的 Agent
  const allAgentIds = [...teamAAgentIds, ...teamBAgentIds];

  // 获取所有参与者的当前排行榜数据
  const leaderboardDataMap = await getLeaderboardData(allAgentIds);

  // 获取获胜和失败队伍的当前 ELO
  const winnersCurrentElo = winnerAgentIds.map(
    (id) => leaderboardDataMap.get(id)?.eloRating ?? DEFAULT_ELO
  );
  const losersCurrentElo = loserAgentIds.map(
    (id) => leaderboardDataMap.get(id)?.eloRating ?? DEFAULT_ELO
  );

  // 计算新的 ELO
  const { winnersNewRatings, losersNewRatings } = calculateTeamElo(
    winnersCurrentElo,
    losersCurrentElo,
    kFactor
  );

  // 使用事务批量更新
  await db.transaction(async (tx) => {
    // 更新获胜队伍
    for (let i = 0; i < winnerAgentIds.length; i++) {
      const agentId = winnerAgentIds[i];
      const currentData = leaderboardDataMap.get(agentId);

      const newGamesPlayed = (currentData?.gamesPlayed ?? 0) + 1;
      const newGamesWon = (currentData?.gamesWon ?? 0) + 1;
      const newWinRate = newGamesWon / newGamesPlayed;

      await tx
        .update(leaderboard)
        .set({
          gamesPlayed: newGamesPlayed,
          gamesWon: newGamesWon,
          winRate: newWinRate,
          eloRating: winnersNewRatings[i],
        })
        .where(eq(leaderboard.agentId, agentId));
    }

    // 更新失败队伍
    for (let i = 0; i < loserAgentIds.length; i++) {
      const agentId = loserAgentIds[i];
      const currentData = leaderboardDataMap.get(agentId);

      const newGamesPlayed = (currentData?.gamesPlayed ?? 0) + 1;
      const newGamesWon = currentData?.gamesWon ?? 0;
      const newWinRate = newGamesWon / newGamesPlayed;

      await tx
        .update(leaderboard)
        .set({
          gamesPlayed: newGamesPlayed,
          gamesWon: newGamesWon,
          winRate: newWinRate,
          eloRating: losersNewRatings[i],
        })
        .where(eq(leaderboard.agentId, agentId));
    }
  });
}

/**
 * 更新回合级别的统计数据
 * @param roundResult 回合结果
 */
export async function updateRoundStats(roundResult: RoundResult): Promise<void> {
  const { participantAgentIds, winnerAgentIds } = roundResult;

  // 转换为 Set 以便快速查找
  const winnerSet = new Set(winnerAgentIds);

  // 使用事务批量更新
  await db.transaction(async (tx) => {
    for (const agentId of participantAgentIds) {
      const isWinner = winnerSet.has(agentId);

      // 获取当前数据
      const result = await tx
        .select({
          roundsPlayed: leaderboard.roundsPlayed,
          roundsWon: leaderboard.roundsWon,
        })
        .from(leaderboard)
        .where(eq(leaderboard.agentId, agentId))
        .limit(1);

      if (result.length > 0) {
        const current = result[0];
        const newRoundsPlayed = current.roundsPlayed + 1;
        const newRoundsWon = isWinner ? current.roundsWon + 1 : current.roundsWon;

        await tx
          .update(leaderboard)
          .set({
            roundsPlayed: newRoundsPlayed,
            roundsWon: newRoundsWon,
          })
          .where(eq(leaderboard.agentId, agentId));
      }
    }
  });
}

/**
 * 获取 Agent 的当前 ELO 分数
 * @param agentId Agent ID
 * @returns ELO 分数，如果未找到则返回默认值 1000
 */
export async function getAgentElo(agentId: string): Promise<number> {
  const result = await db
    .select({ eloRating: leaderboard.eloRating })
    .from(leaderboard)
    .where(eq(leaderboard.agentId, agentId))
    .limit(1);

  return result.length > 0 ? result[0].eloRating : DEFAULT_ELO;
}

/**
 * 批量获取多个 Agent 的 ELO 分数
 * @param agentIds Agent ID 列表
 * @returns Agent ID 到 ELO 分数的映射
 */
export async function getAgentsElo(agentIds: string[]): Promise<Map<string, number>> {
  const results = await db
    .select({
      agentId: leaderboard.agentId,
      eloRating: leaderboard.eloRating,
    })
    .from(leaderboard)
    .where(inArray(leaderboard.agentId, agentIds));

  const eloMap = new Map<string, number>();
  for (const row of results) {
    eloMap.set(row.agentId, row.eloRating);
  }

  // 为未找到的 Agent 设置默认 ELO
  for (const agentId of agentIds) {
    if (!eloMap.has(agentId)) {
      eloMap.set(agentId, DEFAULT_ELO);
    }
  }

  return eloMap;
}
