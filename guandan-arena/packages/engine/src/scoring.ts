import type { Rank, Seat, Team } from '@guandan/shared';
import { NORMAL_RANKS } from '@guandan/shared';
import { getTeamBySeat } from './round.js';

/**
 * 一局的结果
 */
export interface RoundResult {
  /** 出完顺序 [头游, 二游, 三游, 末游] */
  finishOrder: Seat[];
  /** 获胜队伍（头游所在队） */
  winningTeam: Team;
  /** 升级数 */
  levelUp: number;
}

/**
 * 升级结果
 */
export interface AdvanceLevelResult {
  /** 新级数 */
  newLevel: Rank;
  /** 是否已过A（获胜） */
  passedA: boolean;
}

/**
 * 计算一局的结果
 * 
 * 规则：
 * - 头游所在队获胜
 * - 根据赢家队伍队友(二游)的排名决定升级数：
 *   - 头游+二游同队 (队友是2nd) = 升3级（双下对手）
 *   - 头游+三游同队 (队友是3rd) = 升2级 
 *   - 头游+末游同队 (队友是4th) = 升1级
 */
export function calculateRoundResult(finishOrder: Seat[]): RoundResult {
  if (finishOrder.length < 4) {
    throw new Error('finishOrder must have 4 seats');
  }

  // 头游决定获胜队伍
  const firstPlace = finishOrder[0];
  const winningTeam = getTeamBySeat(firstPlace);

  // 找出赢家队伍的队友(非头游)在总排名中的位置
  let teammateFinishIndex = -1;
  for (let i = 1; i < finishOrder.length; i++) {
    if (getTeamBySeat(finishOrder[i]) === winningTeam) {
      teammateFinishIndex = i;
      break;
    }
  }

  // 根据队友的排名决定升级数
  // index 0 = 头游, index 1 = 二游, index 2 = 三游, index 3 = 末游
  let levelUp: number;
  
  if (teammateFinishIndex === 1) {
    // 队友是二游 => 双下对手，升3级
    levelUp = 3;
  } else if (teammateFinishIndex === 2) {
    // 队友是三游 => 升2级
    levelUp = 2;
  } else {
    // 队友是末游 => 升1级
    levelUp = 1;
  }

  return {
    finishOrder,
    winningTeam,
    levelUp,
  };
}

/**
 * 计算升级后的级数
 * 
 * 级数顺序: 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A
 * - 升级按 NORMAL_RANKS 顺序前进
 * - 如果升级到达或超过A，passedA=true（该队获胜）
 */
export function advanceLevel(currentLevel: Rank, steps: number): AdvanceLevelResult {
  // 获取当前级数在 NORMAL_RANKS 中的索引
  const currentIndex = NORMAL_RANKS.indexOf(currentLevel);
  
  if (currentIndex < 0) {
    throw new Error(`Invalid level: ${currentLevel}`);
  }

  const aIndex = NORMAL_RANKS.indexOf('A');
  const newIndex = currentIndex + steps;

  // 检查是否过A
  if (newIndex >= aIndex) {
    return {
      newLevel: 'A',
      passedA: true,
    };
  }

  return {
    newLevel: NORMAL_RANKS[newIndex],
    passedA: false,
  };
}
