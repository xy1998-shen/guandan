import { ComboType, getCardId, type Card, type Rank, type Combo, type Trick } from '@guandan/shared';
import { detectCombo } from './combo-detector.js';
import { canBeat } from './combo-comparator.js';

/**
 * 出牌校验结果
 */
export interface ValidateResult {
  /** 是否合法 */
  valid: boolean;
  /** 识别出的牌型（合法时有值） */
  combo?: Combo;
  /** 不合法的原因 */
  reason?: string;
}

/**
 * 校验出牌是否合法
 * @param cards - 要出的牌
 * @param playerHand - 玩家当前手牌
 * @param currentTrick - 当前一轮出牌（null 表示首出）
 * @param trumpRank - 当前级牌点数
 * @returns 校验结果
 */
export function validatePlay(
  cards: Card[],
  playerHand: Card[],
  currentTrick: Trick | null,
  trumpRank: Rank
): ValidateResult {
  // 空牌不允许（PASS 由上层处理）
  if (!cards || cards.length === 0) {
    return {
      valid: false,
      reason: '出牌不能为空',
    };
  }

  // 检查牌是否都在手牌中
  const handIdSet = new Set<string>(playerHand.map(getCardId));
  const playedIds: string[] = cards.map(getCardId);
  
  // 检查重复出牌
  const playedIdSet = new Set<string>();
  for (const id of playedIds) {
    if (playedIdSet.has(id)) {
      return {
        valid: false,
        reason: '不能出重复的牌',
      };
    }
    playedIdSet.add(id);
  }
  
  // 检查手牌中是否有这些牌
  for (const id of playedIds) {
    if (!handIdSet.has(id)) {
      return {
        valid: false,
        reason: '手牌中没有这张牌',
      };
    }
  }

  // 识别牌型
  const combo = detectCombo(cards, trumpRank);
  if (!combo) {
    return {
      valid: false,
      reason: '无法识别的牌型',
    };
  }

  // 首出：任意合法牌型均可
  if (!currentTrick || currentTrick.plays.length === 0) {
    return {
      valid: true,
      combo,
    };
  }

  // 跟牌：必须能压过上家
  // 找到当前轮次最后一个非 PASS 的出牌
  const lastPlay = [...currentTrick.plays]
    .reverse()
    .find(p => p.combo.type !== ComboType.PASS);

  if (!lastPlay) {
    // 全是 PASS，相当于自己首出
    return {
      valid: true,
      combo,
    };
  }

  // 检查是否能压过
  if (!canBeat(combo, lastPlay.combo, trumpRank)) {
    return {
      valid: false,
      reason: '出的牌必须大于上家',
      combo,
    };
  }

  return {
    valid: true,
    combo,
  };
}

const BOMB_COMBO_TYPES: ComboType[] = [
  ComboType.BOMB_4,
  ComboType.BOMB_5,
  ComboType.BOMB_6,
  ComboType.BOMB_7,
  ComboType.BOMB_8,
  ComboType.STRAIGHT_FLUSH,
  ComboType.ROCKET,
];

function isBombComboType(type: ComboType): boolean {
  return BOMB_COMBO_TYPES.includes(type);
}

function forEachCombination(
  cards: Card[],
  size: number,
  visitor: (comboCards: Card[]) => boolean
): void {
  if (size <= 0 || size > cards.length) {
    return;
  }

  const selected: Card[] = [];

  const dfs = (start: number): boolean => {
    if (selected.length === size) {
      return visitor([...selected]);
    }

    const need = size - selected.length;
    if (cards.length - start < need) {
      return true;
    }

    for (let i = start; i <= cards.length - need; i++) {
      selected.push(cards[i]);
      const shouldContinue = dfs(i + 1);
      selected.pop();
      if (!shouldContinue) {
        return false;
      }
    }

    return true;
  };

  dfs(0);
}

function getCandidateSizes(currentCombo: Combo): number[] {
  const bombSizes = [4, 5, 6, 7, 8];

  if (isBombComboType(currentCombo.type)) {
    return bombSizes;
  }

  let sameTypeSize = 0;
  switch (currentCombo.type) {
    case ComboType.SINGLE:
      sameTypeSize = 1;
      break;
    case ComboType.PAIR:
      sameTypeSize = 2;
      break;
    case ComboType.TRIPLE:
      sameTypeSize = 3;
      break;
    case ComboType.TRIPLE_WITH_TWO:
      sameTypeSize = 5;
      break;
    case ComboType.STRAIGHT:
    case ComboType.STRAIGHT_PAIR:
    case ComboType.PLATE:
      sameTypeSize = currentCombo.cards.length;
      break;
    default:
      sameTypeSize = 0;
      break;
  }

  const sizes = new Set<number>(bombSizes);
  if (sameTypeSize > 0) {
    sizes.add(sameTypeSize);
  }
  return Array.from(sizes);
}

export function findPlayableCombos(
  playerHand: Card[],
  currentCombo: Combo | null,
  trumpRank: Rank,
  maxResults: number = Number.POSITIVE_INFINITY
): Combo[] {
  if (maxResults <= 0 || playerHand.length === 0) {
    return [];
  }

  if (!currentCombo) {
    return playerHand
      .map((card) => detectCombo([card], trumpRank))
      .filter((combo): combo is Combo => combo !== null)
      .slice(0, maxResults);
  }

  const result: Combo[] = [];
  const seen = new Set<string>();
  const candidateSizes = getCandidateSizes(currentCombo).filter((size) => size <= playerHand.length);

  for (const size of candidateSizes) {
    forEachCombination(playerHand, size, (cards) => {
      const combo = detectCombo(cards, trumpRank);
      if (!combo || !canBeat(combo, currentCombo, trumpRank)) {
        return true;
      }

      const comboKey = cards
        .map(getCardId)
        .sort()
        .join('|');
      if (seen.has(comboKey)) {
        return true;
      }

      seen.add(comboKey);
      result.push(combo);

      return result.length < maxResults;
    });

    if (result.length >= maxResults) {
      break;
    }
  }

  return result;
}

/**
 * 检查玩家手牌中是否有能压过当前牌的牌型
 * （用于判断是否必须跟牌，或者提示可出的牌）
 * @param playerHand - 玩家手牌
 * @param currentCombo - 当前要压的牌型
 * @param trumpRank - 当前级牌
 * @returns 是否有能压的牌
 */
export function hasPlayableCards(
  playerHand: Card[],
  currentCombo: Combo | null,
  trumpRank: Rank
): boolean {
  // 首出时，只要有牌就能出
  if (!currentCombo) {
    return playerHand.length > 0;
  }

  return findPlayableCombos(playerHand, currentCombo, trumpRank, 1).length > 0;
}
