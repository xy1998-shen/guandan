import type { Card } from '@guandan/shared';
import { SUITS, NORMAL_RANKS } from '@guandan/shared';

/**
 * 创建两副牌（共108张）
 * 每副牌: 4花色 x 13点数(2-A) = 52张 + 小王 + 大王 = 54张
 * @returns 108张牌的数组
 */
export function createDeck(): Card[] {
  const cards: Card[] = [];

  // 两副牌
  for (let deckIndex = 0; deckIndex < 2; deckIndex++) {
    // 普通牌：4花色 x 13点数
    for (const suit of SUITS) {
      for (const rank of NORMAL_RANKS) {
        cards.push({
          suit,
          rank,
          deckIndex: deckIndex as 0 | 1,
        });
      }
    }

    // 小王
    cards.push({
      suit: 'JOKER',
      rank: 'SMALL',
      deckIndex: deckIndex as 0 | 1,
    });

    // 大王
    cards.push({
      suit: 'JOKER',
      rank: 'BIG',
      deckIndex: deckIndex as 0 | 1,
    });
  }

  return cards;
}

/**
 * Fisher-Yates 洗牌算法
 * @param cards - 待洗的牌
 * @returns 洗好的牌（新数组）
 */
export function shuffle(cards: Card[]): Card[] {
  const result = [...cards];
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * 发牌，每人27张
 * @param deck - 洗好的牌（108张）
 * @returns 四个玩家的手牌
 */
export function dealCards(deck: Card[]): [Card[], Card[], Card[], Card[]] {
  const hands: [Card[], Card[], Card[], Card[]] = [[], [], [], []];
  
  for (let i = 0; i < deck.length; i++) {
    hands[i % 4].push(deck[i]);
  }
  
  return hands;
}
