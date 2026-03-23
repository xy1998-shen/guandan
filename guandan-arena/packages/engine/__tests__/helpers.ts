import type { Card, Suit, Rank } from '@guandan/shared';

/**
 * 快速创建单张牌
 * @param suit - 花色
 * @param rank - 点数
 * @param deckIndex - 副牌索引，默认 0
 */
export function makeCard(suit: Suit, rank: Rank, deckIndex: 0 | 1 = 0): Card {
  return { suit, rank, deckIndex };
}

/**
 * 批量创建牌
 * @param specs - 牌的规格数组，格式: 'SUIT_RANK_DECKINDEX' 或 'SUIT_RANK'
 * 例如: ['S_A_0', 'H_K_1', 'JOKER_SMALL_0', 'JOKER_BIG_1']
 */
export function makeCards(specs: string[]): Card[] {
  return specs.map((spec) => {
    const parts = spec.split('_');
    let suit: Suit;
    let rank: Rank;
    let deckIndex: 0 | 1 = 0;

    if (parts[0] === 'JOKER') {
      // 王牌: JOKER_SMALL_0 或 JOKER_BIG_0
      suit = 'JOKER';
      rank = parts[1] as Rank;
      if (parts.length > 2) {
        deckIndex = parseInt(parts[2], 10) as 0 | 1;
      }
    } else {
      // 普通牌: S_A_0 或 H_K
      suit = parts[0] as Suit;
      rank = parts[1] as Rank;
      if (parts.length > 2) {
        deckIndex = parseInt(parts[2], 10) as 0 | 1;
      }
    }

    return { suit, rank, deckIndex };
  });
}

/**
 * 快速创建同点数多张牌（用于测试炸弹等）
 * @param rank - 点数
 * @param count - 张数
 * @param suits - 使用的花色，默认循环 S, H, D, C
 */
export function makeSameRank(rank: Rank, count: number, suits: Suit[] = ['S', 'H', 'D', 'C']): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    const suitIndex = i % suits.length;
    const deckIndex = Math.floor(i / suits.length) as 0 | 1;
    cards.push({
      suit: suits[suitIndex],
      rank,
      deckIndex,
    });
  }
  return cards;
}

/**
 * 创建连续点数的牌（用于顺子等）
 * @param startRank - 起始点数
 * @param length - 长度
 * @param suit - 花色，默认使用不同花色避免同花顺
 */
export function makeStraightCards(startRank: Rank, length: number, suit?: Suit): Card[] {
  const straightRanks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const startIndex = straightRanks.indexOf(startRank);
  if (startIndex < 0) {
    throw new Error(`Invalid start rank for straight: ${startRank}`);
  }
  if (startIndex + length > straightRanks.length) {
    throw new Error(`Straight too long from ${startRank}`);
  }
  
  const cards: Card[] = [];
  for (let i = 0; i < length; i++) {
    cards.push({
      suit: suit ?? suits[i % suits.length], // 如果没指定花色，使用不同花色
      rank: straightRanks[startIndex + i],
      deckIndex: 0,
    });
  }
  return cards;
}

/**
 * 创建连对
 * @param startRank - 起始点数
 * @param pairCount - 对子数量
 */
export function makeStraightPairs(startRank: Rank, pairCount: number): Card[] {
  const straightRanks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const startIndex = straightRanks.indexOf(startRank);
  if (startIndex < 0 || startIndex + pairCount > straightRanks.length) {
    throw new Error(`Invalid straight pairs from ${startRank}`);
  }
  
  const cards: Card[] = [];
  for (let i = 0; i < pairCount; i++) {
    const rank = straightRanks[startIndex + i];
    cards.push({ suit: 'S', rank, deckIndex: 0 });
    cards.push({ suit: 'H', rank, deckIndex: 0 });
  }
  return cards;
}

/**
 * 创建钢板（连续三条）
 * @param startRank - 起始点数
 * @param tripleCount - 三条数量
 */
export function makePlate(startRank: Rank, tripleCount: number): Card[] {
  const straightRanks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const startIndex = straightRanks.indexOf(startRank);
  if (startIndex < 0 || startIndex + tripleCount > straightRanks.length) {
    throw new Error(`Invalid plate from ${startRank}`);
  }
  
  const cards: Card[] = [];
  for (let i = 0; i < tripleCount; i++) {
    const rank = straightRanks[startIndex + i];
    cards.push({ suit: 'S', rank, deckIndex: 0 });
    cards.push({ suit: 'H', rank, deckIndex: 0 });
    cards.push({ suit: 'D', rank, deckIndex: 0 });
  }
  return cards;
}

/**
 * 创建天王炸（4张王）
 */
export function makeRocket(): Card[] {
  return [
    { suit: 'JOKER', rank: 'SMALL', deckIndex: 0 },
    { suit: 'JOKER', rank: 'SMALL', deckIndex: 1 },
    { suit: 'JOKER', rank: 'BIG', deckIndex: 0 },
    { suit: 'JOKER', rank: 'BIG', deckIndex: 1 },
  ];
}

/**
 * 创建同花顺
 * @param suit - 花色
 * @param startRank - 起始点数
 */
export function makeStraightFlush(suit: Suit, startRank: Rank): Card[] {
  return makeStraightCards(startRank, 5, suit);
}
