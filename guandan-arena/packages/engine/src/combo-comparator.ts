import type { Rank } from '@guandan/shared';
import { ComboType, type Combo, getRankValue } from '@guandan/shared';

/**
 * 炸弹类型的层级（从小到大）
 */
const BOMB_HIERARCHY: ComboType[] = [
  ComboType.BOMB_4,
  ComboType.BOMB_5,
  ComboType.BOMB_6,
  ComboType.BOMB_7,
  ComboType.BOMB_8,
  ComboType.STRAIGHT_FLUSH,
  ComboType.ROCKET,
];

/**
 * 判断是否为炸弹类型
 */
function isBombType(type: ComboType): boolean {
  return BOMB_HIERARCHY.includes(type);
}

/**
 * 获取炸弹的层级值
 */
function getBombLevel(type: ComboType): number {
  return BOMB_HIERARCHY.indexOf(type);
}

/**
 * 比较两个点数的大小（考虑当前级牌）
 * @returns 正数表示 a > b，负数表示 a < b，0 表示相等
 */
function compareRankWithTrump(a: Rank, b: Rank, trumpRank: Rank): number {
  return getRankValue(a, trumpRank) - getRankValue(b, trumpRank);
}

/**
 * 比较两个牌型
 * @param a - 牌型A
 * @param b - 牌型B
 * @param trumpRank - 当前级牌点数
 * @returns 正数表示 a > b，负数表示 a < b，0 表示无法比较或相等
 */
export function compareCombo(a: Combo, b: Combo, trumpRank: Rank): number {
  // PASS 不参与比较
  if (a.type === ComboType.PASS || b.type === ComboType.PASS) {
    return 0;
  }
  
  const aIsBomb = isBombType(a.type);
  const bIsBomb = isBombType(b.type);
  
  // 情况1: 两个都是炸弹
  if (aIsBomb && bIsBomb) {
    const aLevel = getBombLevel(a.type);
    const bLevel = getBombLevel(b.type);
    
    // 不同级别的炸弹，级别高的大
    if (aLevel !== bLevel) {
      return aLevel - bLevel;
    }
    
    // 同级别炸弹，比 mainRank
    // ROCKET 没有 mainRank 比较，都是最大
    if (a.type === ComboType.ROCKET) {
      return 0; // 两个天王炸相等
    }
    
    if (a.mainRank && b.mainRank) {
      return compareRankWithTrump(a.mainRank, b.mainRank, trumpRank);
    }
    
    return 0;
  }
  
  // 情况2: 只有 a 是炸弹
  if (aIsBomb && !bIsBomb) {
    return 1; // a 大
  }
  
  // 情况3: 只有 b 是炸弹
  if (!aIsBomb && bIsBomb) {
    return -1; // b 大
  }
  
  // 情况4: 两个都不是炸弹
  // 必须同类型同长度才能比较
  if (a.type !== b.type) {
    return 0; // 无法比较
  }
  
  // 检查长度（顺子、连对、钢板需要同长度）
  const needLengthMatch = [
    ComboType.STRAIGHT,
    ComboType.STRAIGHT_PAIR,
    ComboType.PLATE,
  ].includes(a.type);
  
  if (needLengthMatch && a.length !== b.length) {
    return 0; // 无法比较
  }
  
  // 同类型同长度，比 mainRank
  if (a.mainRank && b.mainRank) {
    return compareRankWithTrump(a.mainRank, b.mainRank, trumpRank);
  }
  
  return 0;
}

/**
 * 判断牌型 a 是否能压过牌型 b
 * @param a - 要出的牌型
 * @param b - 上家的牌型
 * @param trumpRank - 当前级牌点数
 * @returns 是否能压过
 */
export function canBeat(a: Combo, b: Combo, trumpRank: Rank): boolean {
  const result = compareCombo(a, b, trumpRank);
  return result > 0;
}
