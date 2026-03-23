import type { Rank, Suit } from '../types/card.js';

/**
 * 牌面点数排序值 (从小到大)
 * 在掼蛋中: 2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 小王 < 大王
 */
export const RANK_ORDER: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
  'SMALL': 16,
  'BIG': 17,
};

/**
 * 普通牌面点数 (不含王)，从小到大排序
 */
export const NORMAL_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * 所有花色
 */
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

/**
 * 获取牌面点数的排序值
 * @param rank - 牌面点数
 * @param trumpRank - 级牌点数 (可选，用于特殊排序)
 * @returns 排序值
 */
export function getRankValue(rank: Rank, trumpRank?: Rank): number {
  const baseValue = RANK_ORDER[rank];
  
  // 如果是级牌，在同点数中有特殊排序（略高于普通牌）
  // 级牌在比较时等于同点数的普通牌，但在排序时放在普通牌后面
  if (trumpRank && rank === trumpRank && rank !== 'SMALL' && rank !== 'BIG') {
    return baseValue + 0.5;
  }
  
  return baseValue;
}
