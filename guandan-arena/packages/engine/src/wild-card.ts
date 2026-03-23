import type { Card, Rank, Suit } from '@guandan/shared';

/**
 * 获取万能牌定义
 * 万能牌规则：当前级牌的红心花色(H)为万能牌
 * @param trumpRank - 当前级牌点数
 * @returns 万能牌的花色和点数
 */
export function getWildCards(trumpRank: Rank): { suit: Suit; rank: Rank } {
  return {
    suit: 'H',
    rank: trumpRank,
  };
}

/**
 * 判断一张牌是否为万能牌
 * @param card - 待判断的牌
 * @param trumpRank - 当前级牌点数
 * @returns 是否为万能牌
 */
export function isWildCard(card: Card, trumpRank: Rank): boolean {
  // 王牌不能作为万能牌
  if (card.suit === 'JOKER') {
    return false;
  }
  // 红心级牌为万能牌
  return card.suit === 'H' && card.rank === trumpRank;
}

/**
 * 分离万能牌和普通牌
 * @param cards - 牌组
 * @param trumpRank - 当前级牌点数
 * @returns 分离后的万能牌和普通牌
 */
export function separateWildCards(
  cards: Card[],
  trumpRank: Rank
): { wilds: Card[]; normals: Card[] } {
  const wilds: Card[] = [];
  const normals: Card[] = [];

  for (const card of cards) {
    if (isWildCard(card, trumpRank)) {
      wilds.push(card);
    } else {
      normals.push(card);
    }
  }

  return { wilds, normals };
}
