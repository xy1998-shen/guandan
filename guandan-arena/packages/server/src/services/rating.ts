import { eq, inArray, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { leaderboard, teammateStats, plays, rounds } from '../db/schema.js';
import type { Team } from '@guandan/shared';

/**
 * 炸弹类型集合
 */
const BOMB_TYPES = new Set(['BOMB_4', 'BOMB_5', 'BOMB_6', 'BOMB_7', 'BOMB_8', 'STRAIGHT_FLUSH', 'ROCKET']);

/**
 * ELO 评分系统配置
 */
const DEFAULT_K_FACTOR = 32;
const DEFAULT_ELO = 1000;

/**
 * 游戏结果信息
 */
export interface GameResult {
  /** 游戏 ID */
  gameId?: string;
  /** 获胜队伍 */
  winningTeam: Team;
  /** Team A 的 Agent ID 列表 */
  teamAAgentIds: string[];
  /** Team B 的 Agent ID 列表 */
  teamBAgentIds: string[];
  /** 座位到 Agent ID 的映射 */
  seatToAgentId?: Map<number, string>;
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
  avgResponseTimeMs: number;
  bombTotal: number;
  bombSuccess: number;
  riskScore: number;
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
      avgResponseTimeMs: row.avgResponseTimeMs ?? 0,
      bombTotal: row.bombTotal ?? 0,
      bombSuccess: row.bombSuccess ?? 0,
      riskScore: row.riskScore ?? 0,
    });
  }

  return dataMap;
}

/**
 * 根据游戏结果更新排行榜（包括 ELO 计算、队友配合统计、新增统计字段）
 * 使用事务确保一致性
 * @param gameResult 游戏结果
 * @param kFactor K 系数，默认 32
 */
export async function updateLeaderboardAfterGame(
  gameResult: GameResult,
  kFactor: number = DEFAULT_K_FACTOR
): Promise<void> {
  const { winningTeam, teamAAgentIds, teamBAgentIds, gameId, seatToAgentId } = gameResult;

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

  // 获取游戏统计数据（如果提供了 gameId 和 seatToAgentId）
  const agentGameStats = new Map<string, {
    totalResponseTime: number;
    playCount: number;
    bombTotal: number;
    bombSuccess: number;
    earlyBombCount: number;
    totalBombCount: number;
  }>();

  if (gameId && seatToAgentId) {
    // 初始化每个 agent 的统计
    for (const agentId of allAgentIds) {
      agentGameStats.set(agentId, {
        totalResponseTime: 0,
        playCount: 0,
        bombTotal: 0,
        bombSuccess: 0,
        earlyBombCount: 0,
        totalBombCount: 0,
      });
    }

    // 获取该游戏的所有 round
    const roundsResult = await db
      .select({ id: rounds.id })
      .from(rounds)
      .where(eq(rounds.gameId, gameId));

    // 获取所有出牌记录
    for (const round of roundsResult) {
      const playsResult = await db
        .select()
        .from(plays)
        .where(eq(plays.roundId, round.id));

      for (const play of playsResult) {
        const agentId = seatToAgentId.get(play.seat);
        if (!agentId) continue;

        const stats = agentGameStats.get(agentId);
        if (!stats) continue;

        // 统计响应时间
        if (play.responseTimeMs != null && play.isAutoPlay !== 1) {
          stats.totalResponseTime += play.responseTimeMs;
          stats.playCount++;
        }

        // 统计炸弹
        if (BOMB_TYPES.has(play.comboType)) {
          stats.bombTotal++;
          stats.totalBombCount++;
          
          // 检查是否成功压制（赢得了该 trick）
          if (play.trickWinner === 1) {
            stats.bombSuccess++;
          }

          // 检查是否为早期炸弹（手牌 > 15 张时使用）
          if (play.handCountBefore != null && play.handCountBefore > 15) {
            stats.earlyBombCount++;
          }
        }
      }
    }
  }

  // 使用事务批量更新
  await db.transaction(async (tx) => {
    // 更新获胜队伍
    for (let i = 0; i < winnerAgentIds.length; i++) {
      const agentId = winnerAgentIds[i];
      const currentData = leaderboardDataMap.get(agentId);
      const gameStats = agentGameStats.get(agentId);

      const newGamesPlayed = (currentData?.gamesPlayed ?? 0) + 1;
      const newGamesWon = (currentData?.gamesWon ?? 0) + 1;
      const newWinRate = newGamesWon / newGamesPlayed;

      // 计算新的平均响应时间
      let newAvgResponseTime = currentData?.avgResponseTimeMs ?? 0;
      if (gameStats && gameStats.playCount > 0) {
        const gameAvgResponseTime = gameStats.totalResponseTime / gameStats.playCount;
        // 与历史平均融合（按游戏局数加权）
        const oldGamesPlayed = currentData?.gamesPlayed ?? 0;
        if (oldGamesPlayed > 0) {
          newAvgResponseTime = (newAvgResponseTime * oldGamesPlayed + gameAvgResponseTime) / newGamesPlayed;
        } else {
          newAvgResponseTime = gameAvgResponseTime;
        }
      }

      // 计算新的炸弹统计
      const newBombTotal = (currentData?.bombTotal ?? 0) + (gameStats?.bombTotal ?? 0);
      const newBombSuccess = (currentData?.bombSuccess ?? 0) + (gameStats?.bombSuccess ?? 0);

      // 计算风险评分（使用当前游戏的炸弹数，而非累积总数）
      const riskScore = calculateRiskScore(
        gameStats?.totalBombCount ?? 0,
        gameStats?.playCount ?? 0,
        gameStats?.earlyBombCount ?? 0,
        gameStats?.totalBombCount ?? 0,
        newAvgResponseTime
      );

      await tx
        .update(leaderboard)
        .set({
          gamesPlayed: newGamesPlayed,
          gamesWon: newGamesWon,
          winRate: newWinRate,
          eloRating: winnersNewRatings[i],
          avgResponseTimeMs: newAvgResponseTime,
          bombTotal: newBombTotal,
          bombSuccess: newBombSuccess,
          riskScore: riskScore,
        })
        .where(eq(leaderboard.agentId, agentId));
    }

    // 更新失败队伍
    for (let i = 0; i < loserAgentIds.length; i++) {
      const agentId = loserAgentIds[i];
      const currentData = leaderboardDataMap.get(agentId);
      const gameStats = agentGameStats.get(agentId);

      const newGamesPlayed = (currentData?.gamesPlayed ?? 0) + 1;
      const newGamesWon = currentData?.gamesWon ?? 0;
      const newWinRate = newGamesWon / newGamesPlayed;

      // 计算新的平均响应时间
      let newAvgResponseTime = currentData?.avgResponseTimeMs ?? 0;
      if (gameStats && gameStats.playCount > 0) {
        const gameAvgResponseTime = gameStats.totalResponseTime / gameStats.playCount;
        const oldGamesPlayed = currentData?.gamesPlayed ?? 0;
        if (oldGamesPlayed > 0) {
          newAvgResponseTime = (newAvgResponseTime * oldGamesPlayed + gameAvgResponseTime) / newGamesPlayed;
        } else {
          newAvgResponseTime = gameAvgResponseTime;
        }
      }

      // 计算新的炸弹统计
      const newBombTotal = (currentData?.bombTotal ?? 0) + (gameStats?.bombTotal ?? 0);
      const newBombSuccess = (currentData?.bombSuccess ?? 0) + (gameStats?.bombSuccess ?? 0);

      // 计算风险评分（使用当前游戏的炸弹数，而非累积总数）
      const riskScore = calculateRiskScore(
        gameStats?.totalBombCount ?? 0,
        gameStats?.playCount ?? 0,
        gameStats?.earlyBombCount ?? 0,
        gameStats?.totalBombCount ?? 0,
        newAvgResponseTime
      );

      await tx
        .update(leaderboard)
        .set({
          gamesPlayed: newGamesPlayed,
          gamesWon: newGamesWon,
          winRate: newWinRate,
          eloRating: losersNewRatings[i],
          avgResponseTimeMs: newAvgResponseTime,
          bombTotal: newBombTotal,
          bombSuccess: newBombSuccess,
          riskScore: riskScore,
        })
        .where(eq(leaderboard.agentId, agentId));
    }

    // 更新队友配合统计
    // Team A 的两个 Agent 互为队友
    if (teamAAgentIds.length === 2) {
      const isWin = winningTeam === 'A';
      await updateTeammateStatsForPair(tx, teamAAgentIds[0], teamAAgentIds[1], isWin);
    }

    // Team B 的两个 Agent 互为队友
    if (teamBAgentIds.length === 2) {
      const isWin = winningTeam === 'B';
      await updateTeammateStatsForPair(tx, teamBAgentIds[0], teamBAgentIds[1], isWin);
    }
  });
}

/**
 * 计算风险评分
 * @param bombTotal 总炸弹数
 * @param totalPlays 本局出牌数
 * @param earlyBombCount 早期炸弹数（手牌 > 15 时使用）
 * @param totalBombCount 本局炸弹数
 * @param avgResponseTime 平均响应时间
 * @returns 风险评分 (0-100)
 */
function calculateRiskScore(
  bombTotal: number,
  totalPlays: number,
  earlyBombCount: number,
  totalBombCount: number,
  avgResponseTime: number
): number {
  // 炸弹使用率 (0-1)
  const bombUsageRate = totalPlays > 0 ? Math.min(bombTotal / totalPlays, 1) : 0;
  
  // 早期炸弹率 (0-1) - 在手牌 > 15 时使用炸弹的比例
  const earlyBombRate = totalBombCount > 0 ? earlyBombCount / totalBombCount : 0;
  
  // 响应时间因子 (0-1) - 响应越快评分越高
  const responseTimeFactor = Math.max(0, 1 - avgResponseTime / 10000);
  
  // 综合评分: 炸弹使用率 * 40 + 早期炸弹率 * 30 + 响应时间因子 * 30
  const riskScore = bombUsageRate * 40 + earlyBombRate * 30 + responseTimeFactor * 30;
  
  return Math.min(100, Math.max(0, riskScore));
}

/**
 * 更新一对队友的配合统计
 * @param tx 事务对象
 * @param agentId1 Agent 1 ID
 * @param agentId2 Agent 2 ID
 * @param isWin 是否获胜
 */
async function updateTeammateStatsForPair(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  agentId1: string,
  agentId2: string,
  isWin: boolean
): Promise<void> {
  // 更新 agent1 -> agent2 的记录
  await upsertTeammateStat(tx, agentId1, agentId2, isWin);
  // 更新 agent2 -> agent1 的记录
  await upsertTeammateStat(tx, agentId2, agentId1, isWin);
}

/**
 * 插入或更新队友统计记录
 */
async function upsertTeammateStat(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  agentId: string,
  teammateId: string,
  isWin: boolean
): Promise<void> {
  // 查询现有记录
  const existing = await tx
    .select()
    .from(teammateStats)
    .where(
      and(
        eq(teammateStats.agentId, agentId),
        eq(teammateStats.teammateId, teammateId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // 更新现有记录
    const current = existing[0];
    const newGamesPlayed = (current.gamesPlayed ?? 0) + 1;
    const newGamesWon = (current.gamesWon ?? 0) + (isWin ? 1 : 0);
    const newWinRate = newGamesWon / newGamesPlayed;

    await tx
      .update(teammateStats)
      .set({
        gamesPlayed: newGamesPlayed,
        gamesWon: newGamesWon,
        winRate: newWinRate,
      })
      .where(
        and(
          eq(teammateStats.agentId, agentId),
          eq(teammateStats.teammateId, teammateId)
        )
      );
  } else {
    // 插入新记录
    await tx.insert(teammateStats).values({
      agentId,
      teammateId,
      gamesPlayed: 1,
      gamesWon: isWin ? 1 : 0,
      winRate: isWin ? 1 : 0,
    });
  }
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
