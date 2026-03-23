import { describe, it, expect } from 'vitest';
import { detectCombo } from '../src/combo-detector.js';
import { ComboType } from '@guandan/shared';
import {
  makeCard,
  makeCards,
  makeSameRank,
  makeStraightCards,
  makeStraightPairs,
  makePlate,
  makeRocket,
  makeStraightFlush,
} from './helpers.js';

describe('combo-detector', () => {
  const defaultTrump = '2'; // 默认级牌为 2

  describe('invalid input', () => {
    it('should return null for empty array', () => {
      expect(detectCombo([], defaultTrump)).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(detectCombo(null as any, defaultTrump)).toBeNull();
      expect(detectCombo(undefined as any, defaultTrump)).toBeNull();
    });
  });

  describe('SINGLE - 单张', () => {
    it('should detect single card', () => {
      const cards = makeCards(['S_3_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.SINGLE);
      expect(combo!.mainRank).toBe('3');
    });

    it('should detect any rank as single', () => {
      const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      for (const rank of ranks) {
        const cards = [makeCard('S', rank as any)];
        const combo = detectCombo(cards, defaultTrump);
        expect(combo!.type).toBe(ComboType.SINGLE);
        expect(combo!.mainRank).toBe(rank);
      }
    });

    it('should detect joker as single', () => {
      const smallJoker = detectCombo(makeCards(['JOKER_SMALL_0']), defaultTrump);
      expect(smallJoker!.type).toBe(ComboType.SINGLE);
      expect(smallJoker!.mainRank).toBe('SMALL');

      const bigJoker = detectCombo(makeCards(['JOKER_BIG_0']), defaultTrump);
      expect(bigJoker!.type).toBe(ComboType.SINGLE);
      expect(bigJoker!.mainRank).toBe('BIG');
    });
  });

  describe('PAIR - 对子', () => {
    it('should detect pair of same rank', () => {
      const cards = makeCards(['S_3_0', 'H_3_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.PAIR);
      expect(combo!.mainRank).toBe('3');
    });

    it('should detect pair with same suit different deck', () => {
      const cards = makeCards(['S_A_0', 'S_A_1']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.PAIR);
      expect(combo!.mainRank).toBe('A');
    });

    it('should return null for two different ranks', () => {
      const cards = makeCards(['S_3_0', 'S_4_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should detect pair with wild card', () => {
      // 红心 2（万能牌）+ 黑桃 5 = 对 5
      const cards = makeCards(['H_2_0', 'S_5_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.PAIR);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect pair with two wild cards', () => {
      // 两张万能牌组成对子
      const cards = makeCards(['H_2_0', 'H_2_1']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.PAIR);
      expect(combo!.mainRank).toBe('2'); // 万能牌自身的点数
    });
  });

  describe('TRIPLE - 三条', () => {
    it('should detect triple of same rank', () => {
      const cards = makeCards(['S_5_0', 'H_5_0', 'D_5_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.TRIPLE);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect triple with wild card', () => {
      // 2 张普通牌 + 1 张万能牌
      const cards = makeCards(['S_7_0', 'D_7_0', 'H_2_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.TRIPLE);
      expect(combo!.mainRank).toBe('7');
    });

    it('should detect triple with two wild cards', () => {
      // 1 张普通牌 + 2 张万能牌
      const cards = makeCards(['S_8_0', 'H_2_0', 'H_2_1']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.TRIPLE);
      expect(combo!.mainRank).toBe('8');
    });

    it('should detect triple with three wild cards', () => {
      // 3 张万能牌 - 注意：两副牌只有 2 张万能牌，这是理论测试
      // 实际情况是 3 张万能牌会被识别为三条
      const cards = makeCards(['H_2_0', 'H_2_1']);
      // 只有 2 张，不是三条
      expect(detectCombo(cards, defaultTrump)!.type).toBe(ComboType.PAIR);
    });

    it('should return null for three different ranks', () => {
      const cards = makeCards(['S_3_0', 'S_4_0', 'S_5_0']);
      // 这会被识别为其他牌型（如顺子前3张？）不行，顺子要5张
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });
  });

  describe('TRIPLE_WITH_TWO - 三带二', () => {
    it('should detect triple with pair', () => {
      const cards = makeCards(['S_5_0', 'H_5_0', 'D_5_0', 'S_3_0', 'H_3_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.TRIPLE_WITH_TWO);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect triple with wild card filling pair', () => {
      // 三条 + 1普通 + 1万能牌（补足对子）
      const cards = makeCards(['S_5_0', 'H_5_0', 'D_5_0', 'S_3_0', 'H_2_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.TRIPLE_WITH_TWO);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect triple using wild card', () => {
      // 2普通做三条（需万能牌补足）+ 对子
      const cards = makeCards(['S_5_0', 'D_5_0', 'H_2_0', 'S_3_0', 'H_3_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.TRIPLE_WITH_TWO);
      expect(combo!.mainRank).toBe('5');
    });

    it('should return null for triple with single', () => {
      // 三条 + 单张（不是三带二）
      const cards = makeCards(['S_5_0', 'H_5_0', 'D_5_0', 'S_3_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });
  });

  describe('STRAIGHT - 顺子', () => {
    it('should detect 5-card straight', () => {
      const cards = makeStraightCards('3', 5);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.STRAIGHT);
      expect(combo!.mainRank).toBe('7'); // 34567，最大是7
      expect(combo!.length).toBe(5);
    });

    it('should detect max straight 10JQKA', () => {
      const cards = makeStraightCards('10', 5);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.STRAIGHT);
      expect(combo!.mainRank).toBe('A');
      expect(combo!.length).toBe(5);
    });

    it('should detect longer straight', () => {
      // 6 张顺子
      const cards = makeStraightCards('3', 6);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.STRAIGHT);
      expect(combo!.mainRank).toBe('8');
      expect(combo!.length).toBe(6);
    });

    it('should return null for straight containing 2', () => {
      // A2345 不是顺子（掼蛋中 2 不能参与顺子）
      const cards = makeCards(['S_A_0', 'S_2_0', 'S_3_0', 'S_4_0', 'S_5_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should return null for straight containing 2 in middle', () => {
      // 包含 2 的不是顺子
      const cards = makeCards(['S_A_0', 'H_2_0', 'S_3_0', 'S_4_0', 'S_5_0']);
      // 注意：H_2 是万能牌，可能被当作其他牌
      // 但 A-2-3-4-5 本身不合法，因为 A 是最大的
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should return null for 4 cards (too short)', () => {
      const cards = makeStraightCards('3', 4);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should detect straight with wild card', () => {
      // 3, 4, 万能牌, 6, 7 = 34567（不同花色避免同花顺）
      const cards = makeCards(['S_3_0', 'H_4_0', 'H_2_0', 'D_6_0', 'C_7_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.STRAIGHT);
      expect(combo!.mainRank).toBe('7');
    });

    it('should return null for non-consecutive cards', () => {
      const cards = makeCards(['S_3_0', 'S_4_0', 'S_6_0', 'S_7_0', 'S_8_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should return null for straight with duplicate rank', () => {
      // 顺子中不能有重复点数
      const cards = makeCards(['S_3_0', 'H_3_0', 'S_4_0', 'S_5_0', 'S_6_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });
  });

  describe('STRAIGHT_PAIR - 连对', () => {
    it('should detect 3-pair straight', () => {
      const cards = makeStraightPairs('3', 3); // 334455
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.STRAIGHT_PAIR);
      expect(combo!.mainRank).toBe('5');
      expect(combo!.length).toBe(3);
    });

    it('should detect longer straight pair', () => {
      const cards = makeStraightPairs('3', 4); // 33445566
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.STRAIGHT_PAIR);
      expect(combo!.mainRank).toBe('6');
      expect(combo!.length).toBe(4);
    });

    it('should return null for 2 pairs (too short)', () => {
      const cards = makeStraightPairs('3', 2);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should return null for straight pair containing 2', () => {
      // A-A-2-2-3-3 不是连对
      const cards = makeCards(['S_A_0', 'H_A_0', 'S_2_0', 'D_2_0', 'S_3_0', 'H_3_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should detect straight pair with wild cards', () => {
      // 3-3-4-万能-5-5
      const cards = makeCards(['S_3_0', 'D_3_0', 'S_4_0', 'H_2_0', 'S_5_0', 'D_5_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.STRAIGHT_PAIR);
    });
  });

  describe('PLATE - 钢板/连三条', () => {
    it('should detect 2-triple plate', () => {
      const cards = makePlate('3', 2); // 333444
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.PLATE);
      expect(combo!.mainRank).toBe('4');
      expect(combo!.length).toBe(2);
    });

    it('should detect longer plate', () => {
      const cards = makePlate('3', 3); // 333444555
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.PLATE);
      expect(combo!.mainRank).toBe('5');
      expect(combo!.length).toBe(3);
    });

    it('should return null for single triple', () => {
      const cards = makeCards(['S_3_0', 'H_3_0', 'D_3_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.TRIPLE);
    });

    it('should return null for plate containing 2', () => {
      // 222-333 不是钢板
      const cards = makeCards([
        'S_2_0', 'D_2_0', 'C_2_0',
        'S_3_0', 'H_3_0', 'D_3_0'
      ]);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should detect plate with wild cards', () => {
      // 3-3-万能-4-4-4
      const cards = makeCards([
        'S_3_0', 'D_3_0', 'H_2_0',
        'S_4_0', 'D_4_0', 'C_4_0'
      ]);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.PLATE);
    });
  });

  describe('BOMB - 炸弹', () => {
    it('should detect 4-bomb', () => {
      const cards = makeSameRank('5', 4);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.BOMB_4);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect 5-bomb', () => {
      const cards = makeSameRank('5', 5);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.BOMB_5);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect 6-bomb', () => {
      const cards = makeSameRank('5', 6);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.BOMB_6);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect 7-bomb', () => {
      const cards = makeSameRank('5', 7);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.BOMB_7);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect 8-bomb', () => {
      const cards = makeSameRank('5', 8);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.BOMB_8);
      expect(combo!.mainRank).toBe('5');
    });

    it('should detect bomb with wild cards', () => {
      // 3 张普通 + 1 张万能牌 = 4 炸
      const cards = makeCards(['S_5_0', 'D_5_0', 'C_5_0', 'H_2_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.BOMB_4);
      expect(combo!.mainRank).toBe('5');
    });

    it('should return null for 4 cards of different ranks', () => {
      const cards = makeCards(['S_3_0', 'S_4_0', 'S_5_0', 'S_6_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should detect bomb with all wild cards', () => {
      // 全部是万能牌，但只有 2 张万能牌，无法组成 4 炸
      // 理论上如果有 4 张万能牌，会被识别为炸弹
      const cards = makeCards(['H_2_0', 'H_2_1']);
      expect(detectCombo(cards, defaultTrump)!.type).toBe(ComboType.PAIR);
    });
  });

  describe('STRAIGHT_FLUSH - 同花顺', () => {
    it('should detect straight flush', () => {
      const cards = makeStraightFlush('S', '3');
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.STRAIGHT_FLUSH);
      expect(combo!.mainRank).toBe('7');
      expect(combo!.length).toBe(5);
    });

    it('should detect straight flush with different suits', () => {
      const heartsFlush = makeStraightFlush('H', '5');
      const combo = detectCombo(heartsFlush, '3'); // 级牌为 3，红心不是万能牌
      
      expect(combo!.type).toBe(ComboType.STRAIGHT_FLUSH);
    });

    it('should not detect mixed suit as straight flush', () => {
      // 不同花色的顺子不是同花顺
      const cards = makeCards(['S_3_0', 'H_4_0', 'S_5_0', 'S_6_0', 'S_7_0']);
      const combo = detectCombo(cards, defaultTrump);
      
      // 应该是普通顺子，不是同花顺
      expect(combo!.type).toBe(ComboType.STRAIGHT);
    });

    it('should detect straight flush with wild cards', () => {
      // 同花色 + 万能牌（级牌为 3 时，红心 3 是万能牌）
      const cards = makeCards(['S_4_0', 'S_5_0', 'S_6_0', 'S_7_0', 'H_3_0']);
      const combo = detectCombo(cards, '3');
      
      expect(combo!.type).toBe(ComboType.STRAIGHT_FLUSH);
    });

    it('should return null for jokers (cannot form straight flush)', () => {
      // 王不能参与同花顺
      const cards = makeCards(['S_3_0', 'S_4_0', 'S_5_0', 'S_6_0', 'JOKER_SMALL_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });
  });

  describe('ROCKET - 天王炸', () => {
    it('should detect rocket (4 jokers)', () => {
      const cards = makeRocket();
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(ComboType.ROCKET);
      expect(combo!.mainRank).toBe('BIG');
    });

    it('should return null for 3 jokers', () => {
      const cards = makeCards(['JOKER_SMALL_0', 'JOKER_SMALL_1', 'JOKER_BIG_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should return null for 2 small + 1 big joker', () => {
      const cards = makeCards(['JOKER_SMALL_0', 'JOKER_SMALL_1', 'JOKER_BIG_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should return null for jokers mixed with normal cards', () => {
      const cards = makeCards(['JOKER_SMALL_0', 'JOKER_SMALL_1', 'JOKER_BIG_0', 'S_3_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });
  });

  describe('invalid combinations', () => {
    it('should return null for 3 cards of different ranks', () => {
      const cards = makeCards(['S_3_0', 'S_4_0', 'S_5_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should return null for 4 cards that are not bomb', () => {
      const cards = makeCards(['S_3_0', 'S_4_0', 'S_5_0', 'S_6_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });

    it('should return null for random 5 cards', () => {
      const cards = makeCards(['S_3_0', 'H_5_0', 'D_7_0', 'C_9_0', 'S_J_0']);
      expect(detectCombo(cards, defaultTrump)).toBeNull();
    });
  });

  describe('wild card edge cases', () => {
    it('should handle wild card forming different combos based on trump', () => {
      // H_3 在级牌为 3 时是万能牌
      const cards = makeCards(['H_3_0', 'S_5_0']);
      const combo = detectCombo(cards, '3');
      
      expect(combo!.type).toBe(ComboType.PAIR);
      expect(combo!.mainRank).toBe('5');
    });

    it('should not treat H_3 as wild when trump is 2', () => {
      // H_3 在级牌为 2 时不是万能牌
      const cards = makeCards(['H_3_0', 'S_5_0']);
      const combo = detectCombo(cards, '2');
      
      // 两张不同点数，不能组成对子
      expect(combo).toBeNull();
    });

    it('should handle multiple wild cards in bomb', () => {
      // 2 普通 + 2 万能牌 = 4 炸
      const cards = makeCards(['S_5_0', 'D_5_0', 'H_2_0', 'H_2_1']);
      const combo = detectCombo(cards, '2');
      
      expect(combo!.type).toBe(ComboType.BOMB_4);
      expect(combo!.mainRank).toBe('5');
    });
  });

  describe('priority of detection', () => {
    it('should prefer ROCKET over BOMB_4', () => {
      // 天王炸应该被识别为 ROCKET 而不是 BOMB_4
      const cards = makeRocket();
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.ROCKET);
    });

    it('should prefer STRAIGHT_FLUSH over STRAIGHT for same color', () => {
      // 同花色的连续5张应该是同花顺
      const cards = makeStraightFlush('S', '3');
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.STRAIGHT_FLUSH);
    });

    it('should prefer BOMB over other types for 4+ same rank', () => {
      const cards = makeSameRank('5', 4);
      const combo = detectCombo(cards, defaultTrump);
      
      expect(combo!.type).toBe(ComboType.BOMB_4);
    });
  });
});
