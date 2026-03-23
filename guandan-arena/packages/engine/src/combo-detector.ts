import type { Card, Rank, Suit } from '@guandan/shared';
import { ComboType, type Combo, RANK_ORDER } from '@guandan/shared';
import { separateWildCards } from './wild-card.js';

/**
 * 顺子中有效的点数（不包含2）
 */
const STRAIGHT_RANKS: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/**
 * 获取点数在顺子中的索引位置（-1 表示不能参与顺子）
 */
function getStraightIndex(rank: Rank): number {
  return STRAIGHT_RANKS.indexOf(rank);
}

/**
 * 统计每个点数的数量
 */
function countRanks(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

/**
 * 统计每个花色的牌
 */
function groupBySuit(cards: Card[]): Map<Suit, Card[]> {
  const groups = new Map<Suit, Card[]>();
  for (const card of cards) {
    if (!groups.has(card.suit)) {
      groups.set(card.suit, []);
    }
    groups.get(card.suit)!.push(card);
  }
  return groups;
}

/**
 * 检测是否为天王炸（4张王）
 */
function detectRocket(cards: Card[]): Combo | null {
  if (cards.length !== 4) return null;
  
  const smallJokers = cards.filter(c => c.suit === 'JOKER' && c.rank === 'SMALL');
  const bigJokers = cards.filter(c => c.suit === 'JOKER' && c.rank === 'BIG');
  
  if (smallJokers.length === 2 && bigJokers.length === 2) {
    return {
      type: ComboType.ROCKET,
      cards,
      mainRank: 'BIG',
    };
  }
  return null;
}

/**
 * 检测同花顺（5张同花色连续牌）
 */
function detectStraightFlush(cards: Card[], trumpRank: Rank): Combo | null {
  if (cards.length !== 5) return null;
  
  const { wilds, normals } = separateWildCards(cards, trumpRank);
  const wildCount = wilds.length;
  
  // 按花色分组普通牌
  const suitGroups = groupBySuit(normals);
  
  // 同花顺需要所有普通牌同花色
  if (suitGroups.size > 1) return null;
  
  // 如果只有万能牌，无法判断是同花顺
  if (normals.length === 0) return null;
  
  const suit = normals[0].suit;
  // 王不能参与同花顺
  if (suit === 'JOKER') return null;
  
  // 获取所有点数的顺子索引
  const indices = normals.map(c => getStraightIndex(c.rank)).filter(i => i >= 0);
  if (indices.length !== normals.length) return null; // 有不能参与顺子的牌（2或王）
  
  indices.sort((a, b) => a - b);
  
  // 检查是否能用万能牌填补空缺形成连续5张
  const minIdx = indices[0];
  const maxIdx = indices[indices.length - 1];
  const span = maxIdx - minIdx + 1;
  
  // 跨度超过5，即使有万能牌也不可能形成5张连续
  if (span > 5) return null;
  
  // 需要填补的空缺数
  const gaps = span - indices.length;
  
  // 还需要扩展的数量
  const needed = 5 - span;
  
  // 万能牌需要填补空缺 + 扩展
  if (gaps + needed > wildCount) return null;
  
  // 确定最终的起始索引（可以向低处或高处扩展）
  // 优先向低处扩展，计算最终的 mainRank
  let finalMaxIdx = maxIdx;
  
  if (needed > 0) {
    // 尝试向低处扩展
    const canExtendLow = minIdx;
    const canExtendHigh = STRAIGHT_RANKS.length - 1 - maxIdx;
    
    if (canExtendHigh >= needed) {
      finalMaxIdx = maxIdx + needed;
    } else if (canExtendLow >= needed) {
      // 向低处扩展不改变 finalMaxIdx
    } else {
      // 两边都不够扩展
      return null;
    }
  }
  
  // mainRank 是最高的点数
  const mainRank = STRAIGHT_RANKS[finalMaxIdx];
  
  return {
    type: ComboType.STRAIGHT_FLUSH,
    cards,
    mainRank,
    length: 5,
  };
}

/**
 * 检测炸弹（4-8张同点数）
 */
function detectBomb(cards: Card[], trumpRank: Rank): Combo | null {
  if (cards.length < 4 || cards.length > 8) return null;
  
  const { normals } = separateWildCards(cards, trumpRank);
  
  // 统计普通牌点数
  const rankCounts = countRanks(normals);
  
  // 炸弹需要所有普通牌是同一点数
  if (rankCounts.size > 1) return null;
  
  // 如果有普通牌，mainRank 就是那个点数
  // 如果全是万能牌，mainRank 就是万能牌本身的点数
  let mainRank: Rank;
  if (normals.length > 0) {
    mainRank = normals[0].rank;
    // 王不能单独组成炸弹
    if (normals[0].suit === 'JOKER') return null;
  } else {
    // 全是万能牌，用万能牌的点数
    mainRank = trumpRank;
  }
  
  const bombTypes: Record<number, ComboType> = {
    4: ComboType.BOMB_4,
    5: ComboType.BOMB_5,
    6: ComboType.BOMB_6,
    7: ComboType.BOMB_7,
    8: ComboType.BOMB_8,
  };
  
  const bombType = bombTypes[cards.length];
  if (!bombType) return null;
  
  return {
    type: bombType,
    cards,
    mainRank,
  };
}

/**
 * 检测单张
 */
function detectSingle(cards: Card[]): Combo | null {
  if (cards.length !== 1) return null;
  
  return {
    type: ComboType.SINGLE,
    cards,
    mainRank: cards[0].rank,
  };
}

/**
 * 检测对子
 */
function detectPair(cards: Card[], trumpRank: Rank): Combo | null {
  if (cards.length !== 2) return null;
  
  const { wilds, normals } = separateWildCards(cards, trumpRank);
  
  // 两张万能牌可以组成对子（万能牌自身的点数对子）
  if (wilds.length === 2) {
    return {
      type: ComboType.PAIR,
      cards,
      mainRank: trumpRank,
    };
  }
  
  // 一张万能牌 + 一张普通牌
  if (wilds.length === 1 && normals.length === 1) {
    return {
      type: ComboType.PAIR,
      cards,
      mainRank: normals[0].rank,
    };
  }
  
  // 两张普通牌，点数必须相同
  if (normals.length === 2 && normals[0].rank === normals[1].rank) {
    return {
      type: ComboType.PAIR,
      cards,
      mainRank: normals[0].rank,
    };
  }
  
  return null;
}

/**
 * 检测三条
 */
function detectTriple(cards: Card[], trumpRank: Rank): Combo | null {
  if (cards.length !== 3) return null;
  
  const { normals } = separateWildCards(cards, trumpRank);
  const rankCounts = countRanks(normals);
  
  // 所有普通牌必须同点数
  if (rankCounts.size > 1) return null;
  
  // 确定 mainRank
  let mainRank: Rank;
  if (normals.length > 0) {
    mainRank = normals[0].rank;
  } else {
    // 全是万能牌
    mainRank = trumpRank;
  }
  
  return {
    type: ComboType.TRIPLE,
    cards,
    mainRank,
  };
}

/**
 * 检测三带二
 */
function detectTripleWithTwo(cards: Card[], trumpRank: Rank): Combo | null {
  if (cards.length !== 5) return null;
  
  const { wilds, normals } = separateWildCards(cards, trumpRank);
  const wildCount = wilds.length;
  
  // 统计普通牌点数
  const rankCounts = countRanks(normals);
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const ranks = Array.from(rankCounts.keys());
  
  if (rankCounts.size === 0 && wildCount === 5) {
    // 5张万能牌 - 不好确定牌型，认为无效
    return null;
  }
  
  if (rankCounts.size === 1) {
    // 只有一种点数的普通牌
    const count = counts[0];
    const rank = ranks[0];
    
    if (count >= 3 && wildCount >= 2) {
      // 3+普通牌做三条，2+万能牌做对子
      return {
        type: ComboType.TRIPLE_WITH_TWO,
        cards,
        mainRank: rank,
      };
    }
    if (count === 2 && wildCount >= 3) {
      // 2普通牌做对子，3万能牌可以组三条（点数用万能牌自身点数）
      // 但这样三条和对子可能同点数，不符合三带二规则
      // 如果万能牌点数 != rank，可以用万能牌做三条
      if (trumpRank !== rank) {
        return {
          type: ComboType.TRIPLE_WITH_TWO,
          cards,
          mainRank: trumpRank,
        };
      }
      return null;
    }
    if (count === 1 && wildCount >= 4) {
      // 1普通牌 + 4万能牌
      // 可以是: 3万能(trump) + 1普通+1万能 = 三条(trump) + 对(rank)
      if (trumpRank !== rank) {
        return {
          type: ComboType.TRIPLE_WITH_TWO,
          cards,
          mainRank: trumpRank,
        };
      }
      return null;
    }
  }
  
  if (rankCounts.size === 2) {
    // 两种点数的普通牌
    const [rank1, rank2] = ranks;
    const [count1, count2] = [rankCounts.get(rank1)!, rankCounts.get(rank2)!];
    
    // 情况1: 一种>=3做三条，另一种>=2做对子（或用万能牌补足）
    if (count1 >= 3 && count2 + wildCount >= 2) {
      return {
        type: ComboType.TRIPLE_WITH_TWO,
        cards,
        mainRank: rank1,
      };
    }
    if (count2 >= 3 && count1 + wildCount >= 2) {
      return {
        type: ComboType.TRIPLE_WITH_TWO,
        cards,
        mainRank: rank2,
      };
    }
    
    // 情况2: 一种>=2可用万能牌补成三条，另一种>=2做对子
    if (count1 >= 2 && count1 + wildCount >= 3 && count2 >= 2) {
      return {
        type: ComboType.TRIPLE_WITH_TWO,
        cards,
        mainRank: rank1,
      };
    }
    if (count2 >= 2 && count2 + wildCount >= 3 && count1 >= 2) {
      return {
        type: ComboType.TRIPLE_WITH_TWO,
        cards,
        mainRank: rank2,
      };
    }
    
    // 情况3: 两种都是2张，用万能牌补其中一种到3
    if (count1 === 2 && count2 === 2 && wildCount >= 1) {
      // 选择点数大的做三条
      const mainRank = RANK_ORDER[rank1] > RANK_ORDER[rank2] ? rank1 : rank2;
      return {
        type: ComboType.TRIPLE_WITH_TWO,
        cards,
        mainRank,
      };
    }
  }
  
  return null;
}

/**
 * 检测顺子（5+张连续点数）
 */
function detectStraight(cards: Card[], trumpRank: Rank): Combo | null {
  if (cards.length < 5) return null;
  
  const { wilds, normals } = separateWildCards(cards, trumpRank);
  const wildCount = wilds.length;
  
  // 检查是否有不能参与顺子的牌（2和王）
  for (const card of normals) {
    if (card.suit === 'JOKER' || card.rank === '2') {
      return null;
    }
  }
  
  // 获取所有点数的顺子索引
  const indexCounts = new Map<number, number>();
  for (const card of normals) {
    const idx = getStraightIndex(card.rank);
    if (idx < 0) return null;
    indexCounts.set(idx, (indexCounts.get(idx) || 0) + 1);
  }
  
  // 顺子中每个位置最多1张牌
  for (const count of indexCounts.values()) {
    if (count > 1) return null;
  }
  
  const indices = Array.from(indexCounts.keys()).sort((a, b) => a - b);
  
  if (indices.length === 0 && wildCount >= 5) {
    // 全是万能牌，可以组成任意顺子
    // 默认使用最小的顺子 34567
    return {
      type: ComboType.STRAIGHT,
      cards,
      mainRank: '7',
      length: cards.length,
    };
  }
  
  if (indices.length === 0) return null;
  
  const minIdx = indices[0];
  const maxIdx = indices[indices.length - 1];
  const span = maxIdx - minIdx + 1;
  
  // 检查跨度是否能形成目标长度的顺子
  if (span > cards.length) return null;
  
  // 需要填补的空缺数
  const gaps = span - indices.length;
  
  // 还需要扩展的数量
  const needed = cards.length - span;
  
  if (gaps + needed > wildCount) return null;
  
  // 确定最终的范围
  let finalMaxIdx = maxIdx;
  
  if (needed > 0) {
    // 尝试向两边扩展
    const canExtendLow = minIdx;
    const canExtendHigh = STRAIGHT_RANKS.length - 1 - maxIdx;
    
    // 优先向高处扩展
    const extendHigh = Math.min(needed, canExtendHigh);
    const extendLow = needed - extendHigh;
    
    if (extendLow > canExtendLow) return null;
    
    finalMaxIdx = maxIdx + extendHigh;
  }
  
  const mainRank = STRAIGHT_RANKS[finalMaxIdx];
  
  return {
    type: ComboType.STRAIGHT,
    cards,
    mainRank,
    length: cards.length,
  };
}

/**
 * 检测连对（3+对连续）
 */
function detectStraightPair(cards: Card[], trumpRank: Rank): Combo | null {
  if (cards.length < 6 || cards.length % 2 !== 0) return null;
  
  const pairCount = cards.length / 2;
  if (pairCount < 3) return null;
  
  const { wilds, normals } = separateWildCards(cards, trumpRank);
  const wildCount = wilds.length;
  
  // 检查是否有不能参与顺子的牌
  for (const card of normals) {
    if (card.suit === 'JOKER' || card.rank === '2') {
      return null;
    }
  }
  
  // 统计每个位置的数量
  const indexCounts = new Map<number, number>();
  for (const card of normals) {
    const idx = getStraightIndex(card.rank);
    if (idx < 0) return null;
    indexCounts.set(idx, (indexCounts.get(idx) || 0) + 1);
  }
  
  // 每个位置最多2张
  for (const count of indexCounts.values()) {
    if (count > 2) return null;
  }
  
  const indices = Array.from(indexCounts.keys()).sort((a, b) => a - b);
  
  if (indices.length === 0 && wildCount >= 6) {
    // 全是万能牌
    return {
      type: ComboType.STRAIGHT_PAIR,
      cards,
      mainRank: STRAIGHT_RANKS[pairCount - 1],
      length: pairCount,
    };
  }
  
  if (indices.length === 0) return null;
  
  const minIdx = indices[0];
  const maxIdx = indices[indices.length - 1];
  const span = maxIdx - minIdx + 1;
  
  if (span > pairCount) return null;
  
  // 计算需要多少万能牌
  // 每个位置需要2张，计算缺口
  let neededWilds = 0;
  for (let i = minIdx; i <= maxIdx; i++) {
    const have = indexCounts.get(i) || 0;
    neededWilds += 2 - have;
  }
  
  // 还需要扩展的对子数
  const neededPairs = pairCount - span;
  neededWilds += neededPairs * 2;
  
  if (neededWilds > wildCount) return null;
  
  // 确定最终范围
  let finalMaxIdx = maxIdx;
  if (neededPairs > 0) {
    const canExtendHigh = STRAIGHT_RANKS.length - 1 - maxIdx;
    const canExtendLow = minIdx;
    
    if (canExtendHigh >= neededPairs) {
      finalMaxIdx = maxIdx + neededPairs;
    } else if (canExtendLow >= neededPairs) {
      finalMaxIdx = maxIdx; // 向低处扩展不改变 maxIdx
    } else {
      return null;
    }
  }
  
  return {
    type: ComboType.STRAIGHT_PAIR,
    cards,
    mainRank: STRAIGHT_RANKS[finalMaxIdx],
    length: pairCount,
  };
}

/**
 * 检测钢板/连三条（2+组连续三条）
 */
function detectPlate(cards: Card[], trumpRank: Rank): Combo | null {
  if (cards.length < 6 || cards.length % 3 !== 0) return null;
  
  const tripleCount = cards.length / 3;
  if (tripleCount < 2) return null;
  
  const { wilds, normals } = separateWildCards(cards, trumpRank);
  const wildCount = wilds.length;
  
  // 检查是否有不能参与顺子的牌
  for (const card of normals) {
    if (card.suit === 'JOKER' || card.rank === '2') {
      return null;
    }
  }
  
  // 统计每个位置的数量
  const indexCounts = new Map<number, number>();
  for (const card of normals) {
    const idx = getStraightIndex(card.rank);
    if (idx < 0) return null;
    indexCounts.set(idx, (indexCounts.get(idx) || 0) + 1);
  }
  
  // 每个位置最多3张（两副牌中同点数最多8张，但钢板每组只要3张）
  for (const count of indexCounts.values()) {
    if (count > 3) return null;
  }
  
  const indices = Array.from(indexCounts.keys()).sort((a, b) => a - b);
  
  if (indices.length === 0 && wildCount >= 6) {
    // 全是万能牌
    return {
      type: ComboType.PLATE,
      cards,
      mainRank: STRAIGHT_RANKS[tripleCount - 1],
      length: tripleCount,
    };
  }
  
  if (indices.length === 0) return null;
  
  const minIdx = indices[0];
  const maxIdx = indices[indices.length - 1];
  const span = maxIdx - minIdx + 1;
  
  if (span > tripleCount) return null;
  
  // 计算需要多少万能牌
  let neededWilds = 0;
  for (let i = minIdx; i <= maxIdx; i++) {
    const have = indexCounts.get(i) || 0;
    neededWilds += 3 - have;
  }
  
  const neededTriples = tripleCount - span;
  neededWilds += neededTriples * 3;
  
  if (neededWilds > wildCount) return null;
  
  // 确定最终范围
  let finalMaxIdx = maxIdx;
  if (neededTriples > 0) {
    const canExtendHigh = STRAIGHT_RANKS.length - 1 - maxIdx;
    const canExtendLow = minIdx;
    
    if (canExtendHigh >= neededTriples) {
      finalMaxIdx = maxIdx + neededTriples;
    } else if (canExtendLow >= neededTriples) {
      finalMaxIdx = maxIdx;
    } else {
      return null;
    }
  }
  
  return {
    type: ComboType.PLATE,
    cards,
    mainRank: STRAIGHT_RANKS[finalMaxIdx],
    length: tripleCount,
  };
}

/**
 * 识别牌型
 * @param cards - 要识别的牌组
 * @param trumpRank - 当前级牌点数
 * @returns 识别出的牌型，无法识别返回 null
 */
export function detectCombo(cards: Card[], trumpRank: Rank): Combo | null {
  if (!cards || cards.length === 0) {
    return null;
  }
  
  // 按优先级检测各种牌型
  
  // 1. 天王炸（最大的牌型）
  const rocket = detectRocket(cards);
  if (rocket) return rocket;
  
  // 2. 同花顺（必须5张）
  const straightFlush = detectStraightFlush(cards, trumpRank);
  if (straightFlush) return straightFlush;
  
  // 3. 炸弹（4-8张同点数）
  const bomb = detectBomb(cards, trumpRank);
  if (bomb) return bomb;
  
  // 4. 单张
  const single = detectSingle(cards);
  if (single) return single;
  
  // 5. 对子
  const pair = detectPair(cards, trumpRank);
  if (pair) return pair;
  
  // 6. 三条
  const triple = detectTriple(cards, trumpRank);
  if (triple) return triple;
  
  // 7. 三带二
  const tripleWithTwo = detectTripleWithTwo(cards, trumpRank);
  if (tripleWithTwo) return tripleWithTwo;
  
  // 8. 顺子（5+张连续）
  const straight = detectStraight(cards, trumpRank);
  if (straight) return straight;
  
  // 9. 连对（3+对连续）
  const straightPair = detectStraightPair(cards, trumpRank);
  if (straightPair) return straightPair;
  
  // 10. 钢板（2+组连续三条）
  const plate = detectPlate(cards, trumpRank);
  if (plate) return plate;
  
  return null;
}
