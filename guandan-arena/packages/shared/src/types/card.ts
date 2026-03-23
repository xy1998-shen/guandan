/**
 * 花色类型
 * S = Spades (黑桃), H = Hearts (红心), D = Diamonds (方块), C = Clubs (梅花), JOKER = 王
 */
export type Suit = 'S' | 'H' | 'D' | 'C' | 'JOKER';

/**
 * 牌面点数类型
 * 数字牌: 2-10, 字母牌: J, Q, K, A
 * SMALL = 小王, BIG = 大王
 */
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'SMALL' | 'BIG';

/**
 * 单张牌
 */
export interface Card {
  /** 花色 */
  suit: Suit;
  /** 点数 */
  rank: Rank;
  /** 来自第几副牌 (0 或 1) */
  deckIndex: 0 | 1;
}

/**
 * 获取牌的唯一 ID
 * 格式: `${suit}_${rank}_${deckIndex}`, 如 "S_A_0"
 */
export function getCardId(card: Card): string {
  return `${card.suit}_${card.rank}_${card.deckIndex}`;
}
