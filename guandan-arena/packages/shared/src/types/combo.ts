import type { Card, Rank } from './card.js';

/**
 * 牌型枚举
 */
export enum ComboType {
  /** 过牌 */
  PASS = 'PASS',
  /** 单张 */
  SINGLE = 'SINGLE',
  /** 对子 */
  PAIR = 'PAIR',
  /** 三张 */
  TRIPLE = 'TRIPLE',
  /** 三带二 */
  TRIPLE_WITH_TWO = 'TRIPLE_WITH_TWO',
  /** 顺子 (5张以上连续单牌) */
  STRAIGHT = 'STRAIGHT',
  /** 连对 (3对以上连续对子) */
  STRAIGHT_PAIR = 'STRAIGHT_PAIR',
  /** 钢板/连三条 (2组以上连续三张) */
  PLATE = 'PLATE',
  /** 4张炸弹 */
  BOMB_4 = 'BOMB_4',
  /** 5张炸弹 */
  BOMB_5 = 'BOMB_5',
  /** 6张炸弹 */
  BOMB_6 = 'BOMB_6',
  /** 7张炸弹 */
  BOMB_7 = 'BOMB_7',
  /** 8张炸弹 */
  BOMB_8 = 'BOMB_8',
  /** 同花顺 (5张同花色连续牌) */
  STRAIGHT_FLUSH = 'STRAIGHT_FLUSH',
  /** 天王炸 (4张王) */
  ROCKET = 'ROCKET',
}

/**
 * 牌型组合
 */
export interface Combo {
  /** 牌型类型 */
  type: ComboType;
  /** 组成此牌型的牌 */
  cards: Card[];
  /** 主牌点数 (用于比较大小) */
  mainRank?: Rank;
  /** 牌型长度 (顺子/连对/钢板的长度) */
  length?: number;
}
