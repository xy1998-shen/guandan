import { describe, it, expect, vi } from 'vitest';
import { compareCombo, canBeat } from '../src/combo-comparator.js';
import { detectCombo } from '../src/combo-detector.js';
import { ComboType, type Combo, type Card } from '@guandan/shared';
import * as shared from '@guandan/shared';
import {
  makeCards,
  makeSameRank,
  makeStraightCards,
  makeStraightPairs,
  makePlate,
  makeRocket,
  makeStraightFlush,
} from './helpers.js';

describe('combo-comparator', () => {
  const defaultTrump = '2';

  // Helper to create combo from cards
  function makeCombo(cards: Card[]): Combo {
    const combo = detectCombo(cards, defaultTrump);
    if (!combo) throw new Error('Invalid combo');
    return combo;
  }

  describe('compareCombo - same type comparison', () => {
    describe('SINGLE comparison', () => {
      it('should compare singles by rank', () => {
        const single3 = makeCombo(makeCards(['S_3_0']));
        const single5 = makeCombo(makeCards(['S_5_0']));
        const singleA = makeCombo(makeCards(['S_A_0']));

        expect(compareCombo(single5, single3, defaultTrump)).toBeGreaterThan(0);
        expect(compareCombo(single3, single5, defaultTrump)).toBeLessThan(0);
        expect(compareCombo(singleA, single5, defaultTrump)).toBeGreaterThan(0);
      });

      it('should compare jokers correctly', () => {
        const singleA = makeCombo(makeCards(['S_A_0']));
        const smallJoker = makeCombo(makeCards(['JOKER_SMALL_0']));
        const bigJoker = makeCombo(makeCards(['JOKER_BIG_0']));

        expect(compareCombo(smallJoker, singleA, defaultTrump)).toBeGreaterThan(0);
        expect(compareCombo(bigJoker, smallJoker, defaultTrump)).toBeGreaterThan(0);
      });

      it('should return 0 for same rank singles', () => {
        const single3a = makeCombo(makeCards(['S_3_0']));
        const single3b = makeCombo(makeCards(['H_3_0']));

        expect(compareCombo(single3a, single3b, defaultTrump)).toBe(0);
      });
    });

    describe('PAIR comparison', () => {
      it('should compare pairs by rank', () => {
        const pair3 = makeCombo(makeCards(['S_3_0', 'H_3_0']));
        const pair5 = makeCombo(makeCards(['S_5_0', 'H_5_0']));
        const pairA = makeCombo(makeCards(['S_A_0', 'H_A_0']));

        expect(compareCombo(pair5, pair3, defaultTrump)).toBeGreaterThan(0);
        expect(compareCombo(pairA, pair5, defaultTrump)).toBeGreaterThan(0);
        expect(compareCombo(pair3, pairA, defaultTrump)).toBeLessThan(0);
      });
    });

    describe('TRIPLE comparison', () => {
      it('should compare triples by rank', () => {
        const triple3 = makeCombo(makeCards(['S_3_0', 'H_3_0', 'D_3_0']));
        const triple7 = makeCombo(makeCards(['S_7_0', 'H_7_0', 'D_7_0']));

        expect(compareCombo(triple7, triple3, defaultTrump)).toBeGreaterThan(0);
        expect(compareCombo(triple3, triple7, defaultTrump)).toBeLessThan(0);
      });
    });

    describe('TRIPLE_WITH_TWO comparison', () => {
      it('should compare by main rank (triple part)', () => {
        const tw5 = makeCombo(makeCards(['S_5_0', 'H_5_0', 'D_5_0', 'S_3_0', 'H_3_0']));
        const tw7 = makeCombo(makeCards(['S_7_0', 'H_7_0', 'D_7_0', 'S_4_0', 'H_4_0']));

        expect(compareCombo(tw7, tw5, defaultTrump)).toBeGreaterThan(0);
      });
    });

    describe('STRAIGHT comparison', () => {
      it('should compare straights of same length by highest card', () => {
        const straight34567 = makeCombo(makeStraightCards('3', 5));
        const straight45678 = makeCombo(makeStraightCards('4', 5));

        expect(compareCombo(straight45678, straight34567, defaultTrump)).toBeGreaterThan(0);
      });

      it('should return 0 for different length straights', () => {
        const straight5 = makeCombo(makeStraightCards('3', 5));
        const straight6 = makeCombo(makeStraightCards('3', 6));

        expect(compareCombo(straight6, straight5, defaultTrump)).toBe(0);
      });
    });

    describe('STRAIGHT_PAIR comparison', () => {
      it('should compare straight pairs of same length', () => {
        const sp334455 = makeCombo(makeStraightPairs('3', 3));
        const sp445566 = makeCombo(makeStraightPairs('4', 3));

        expect(compareCombo(sp445566, sp334455, defaultTrump)).toBeGreaterThan(0);
      });

      it('should return 0 for different length straight pairs', () => {
        const sp3 = makeCombo(makeStraightPairs('3', 3));
        const sp4 = makeCombo(makeStraightPairs('3', 4));

        expect(compareCombo(sp4, sp3, defaultTrump)).toBe(0);
      });
    });

    describe('PLATE comparison', () => {
      it('should compare plates of same length', () => {
        const plate34 = makeCombo(makePlate('3', 2));
        const plate45 = makeCombo(makePlate('4', 2));

        expect(compareCombo(plate45, plate34, defaultTrump)).toBeGreaterThan(0);
      });
    });
  });

  describe('compareCombo - bomb hierarchy', () => {
    it('should rank BOMB_5 > BOMB_4', () => {
      const bomb4 = makeCombo(makeSameRank('A', 4));
      const bomb5 = makeCombo(makeSameRank('3', 5));

      expect(compareCombo(bomb5, bomb4, defaultTrump)).toBeGreaterThan(0);
    });

    it('should rank BOMB_6 > BOMB_5', () => {
      const bomb5 = makeCombo(makeSameRank('A', 5));
      const bomb6 = makeCombo(makeSameRank('3', 6));

      expect(compareCombo(bomb6, bomb5, defaultTrump)).toBeGreaterThan(0);
    });

    it('should rank BOMB_7 > BOMB_6', () => {
      const bomb6 = makeCombo(makeSameRank('A', 6));
      const bomb7 = makeCombo(makeSameRank('3', 7));

      expect(compareCombo(bomb7, bomb6, defaultTrump)).toBeGreaterThan(0);
    });

    it('should rank BOMB_8 > BOMB_7', () => {
      const bomb7 = makeCombo(makeSameRank('A', 7));
      const bomb8 = makeCombo(makeSameRank('3', 8));

      expect(compareCombo(bomb8, bomb7, defaultTrump)).toBeGreaterThan(0);
    });

    it('should rank STRAIGHT_FLUSH > BOMB_8', () => {
      const bomb8 = makeCombo(makeSameRank('A', 8));
      const straightFlush = makeCombo(makeStraightFlush('S', '3'));

      expect(compareCombo(straightFlush, bomb8, defaultTrump)).toBeGreaterThan(0);
    });

    it('should rank ROCKET > STRAIGHT_FLUSH', () => {
      const straightFlush = makeCombo(makeStraightFlush('S', '10')); // 最大同花顺
      const rocket = makeCombo(makeRocket());

      expect(compareCombo(rocket, straightFlush, defaultTrump)).toBeGreaterThan(0);
    });

    it('should compare same level bombs by rank', () => {
      const bomb4_3 = makeCombo(makeSameRank('3', 4));
      const bomb4_A = makeCombo(makeSameRank('A', 4));

      expect(compareCombo(bomb4_A, bomb4_3, defaultTrump)).toBeGreaterThan(0);
      expect(compareCombo(bomb4_3, bomb4_A, defaultTrump)).toBeLessThan(0);
    });

    it('should compare same level straight flushes by rank', () => {
      const sf_low = makeCombo(makeStraightFlush('S', '3'));
      const sf_high = makeCombo(makeStraightFlush('H', '10'));

      expect(compareCombo(sf_high, sf_low, '3')).toBeGreaterThan(0); // 用不同级牌避免万能牌干扰
    });

    it('should return 0 for two rockets', () => {
      const rocket1 = makeCombo(makeRocket());
      const rocket2: Combo = { type: ComboType.ROCKET, cards: makeRocket(), mainRank: 'BIG' };

      expect(compareCombo(rocket1, rocket2, defaultTrump)).toBe(0);
    });
  });

  describe('compareCombo - bomb vs non-bomb', () => {
    it('should rank any bomb higher than non-bomb', () => {
      const bomb4 = makeCombo(makeSameRank('3', 4));
      const pairA = makeCombo(makeCards(['S_A_0', 'H_A_0']));
      const singleBig = makeCombo(makeCards(['JOKER_BIG_0']));
      const straight = makeCombo(makeStraightCards('10', 5));

      expect(compareCombo(bomb4, pairA, defaultTrump)).toBeGreaterThan(0);
      expect(compareCombo(bomb4, singleBig, defaultTrump)).toBeGreaterThan(0);
      expect(compareCombo(bomb4, straight, defaultTrump)).toBeGreaterThan(0);
    });

    it('should rank non-bomb lower than any bomb', () => {
      const bomb4 = makeCombo(makeSameRank('3', 4));
      const tripleA = makeCombo(makeCards(['S_A_0', 'H_A_0', 'D_A_0']));

      expect(compareCombo(tripleA, bomb4, defaultTrump)).toBeLessThan(0);
    });
  });

  describe('compareCombo - different non-bomb types', () => {
    it('should return 0 for different types (cannot compare)', () => {
      const single = makeCombo(makeCards(['S_A_0']));
      const pair = makeCombo(makeCards(['S_5_0', 'H_5_0']));

      expect(compareCombo(single, pair, defaultTrump)).toBe(0);
      expect(compareCombo(pair, single, defaultTrump)).toBe(0);
    });

    it('should return 0 for pair vs triple', () => {
      const pair = makeCombo(makeCards(['S_A_0', 'H_A_0']));
      const triple = makeCombo(makeCards(['S_3_0', 'H_3_0', 'D_3_0']));

      expect(compareCombo(pair, triple, defaultTrump)).toBe(0);
    });

    it('should return 0 for straight vs straight pair', () => {
      const straight = makeCombo(makeStraightCards('3', 5));
      const straightPair = makeCombo(makeStraightPairs('3', 3));

      expect(compareCombo(straight, straightPair, defaultTrump)).toBe(0);
    });
  });

  describe('compareCombo - PASS handling', () => {
    it('should return 0 when either is PASS', () => {
      const passCombo: Combo = { type: ComboType.PASS, cards: [] };
      const single = makeCombo(makeCards(['S_3_0']));

      expect(compareCombo(passCombo, single, defaultTrump)).toBe(0);
      expect(compareCombo(single, passCombo, defaultTrump)).toBe(0);
    });
  });

  describe('canBeat', () => {
    it('should return true when a beats b', () => {
      const pair5 = makeCombo(makeCards(['S_5_0', 'H_5_0']));
      const pair3 = makeCombo(makeCards(['S_3_0', 'H_3_0']));

      expect(canBeat(pair5, pair3, defaultTrump)).toBe(true);
    });

    it('should return false when a cannot beat b', () => {
      const pair3 = makeCombo(makeCards(['S_3_0', 'H_3_0']));
      const pair5 = makeCombo(makeCards(['S_5_0', 'H_5_0']));

      expect(canBeat(pair3, pair5, defaultTrump)).toBe(false);
    });

    it('should return false for same rank', () => {
      const pair5a = makeCombo(makeCards(['S_5_0', 'H_5_0']));
      const pair5b = makeCombo(makeCards(['D_5_0', 'C_5_0']));

      expect(canBeat(pair5a, pair5b, defaultTrump)).toBe(false);
    });

    it('should return true for bomb beating non-bomb', () => {
      const bomb4 = makeCombo(makeSameRank('3', 4));
      const pairA = makeCombo(makeCards(['S_A_0', 'H_A_0']));

      expect(canBeat(bomb4, pairA, defaultTrump)).toBe(true);
    });

    it('should return false for non-bomb beating bomb', () => {
      const bomb4 = makeCombo(makeSameRank('3', 4));
      const pairA = makeCombo(makeCards(['S_A_0', 'H_A_0']));

      expect(canBeat(pairA, bomb4, defaultTrump)).toBe(false);
    });

    it('should return true for bigger bomb beating smaller bomb', () => {
      const bomb4 = makeCombo(makeSameRank('A', 4));
      const bomb5 = makeCombo(makeSameRank('3', 5));

      expect(canBeat(bomb5, bomb4, defaultTrump)).toBe(true);
    });

    it('should return false when types cannot compare', () => {
      const single = makeCombo(makeCards(['S_A_0']));
      const pair = makeCombo(makeCards(['S_3_0', 'H_3_0']));

      expect(canBeat(single, pair, defaultTrump)).toBe(false);
      expect(canBeat(pair, single, defaultTrump)).toBe(false);
    });

    it('should return true for rocket beating any bomb', () => {
      const rocket = makeCombo(makeRocket());
      const bomb8 = makeCombo(makeSameRank('A', 8));

      expect(canBeat(rocket, bomb8, defaultTrump)).toBe(true);
    });

    it('should return false for rocket beating rocket', () => {
      const rocket1 = makeCombo(makeRocket());
      const rocket2: Combo = { type: ComboType.ROCKET, cards: makeRocket(), mainRank: 'BIG' };

      expect(canBeat(rocket1, rocket2, defaultTrump)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle 2 correctly in rank comparison', () => {
      const pair2 = makeCombo(makeCards(['S_2_0', 'D_2_0'])); // 级牌为 2，H_2 是万能牌
      const pair3 = makeCombo(makeCards(['S_3_0', 'H_3_0']));

      // 2 < 3
      expect(compareCombo(pair3, pair2, defaultTrump)).toBeGreaterThan(0);
      expect(canBeat(pair3, pair2, defaultTrump)).toBe(true);
    });

    it('should handle joker ranks in comparison', () => {
      const singleSmall = makeCombo(makeCards(['JOKER_SMALL_0']));
      const singleBig = makeCombo(makeCards(['JOKER_BIG_0']));
      const singleA = makeCombo(makeCards(['S_A_0']));

      expect(compareCombo(singleSmall, singleA, defaultTrump)).toBeGreaterThan(0);
      expect(compareCombo(singleBig, singleSmall, defaultTrump)).toBeGreaterThan(0);
    });

    it('should pass trumpRank into rank comparison', () => {
      const spy = vi.spyOn(shared, 'getRankValue');
      const pair3 = makeCombo(makeCards(['S_3_0', 'H_3_0']));
      const pair5 = makeCombo(makeCards(['S_5_0', 'H_5_0']));

      compareCombo(pair5, pair3, 'A');

      expect(spy).toHaveBeenCalledWith('5', 'A');
      expect(spy).toHaveBeenCalledWith('3', 'A');
      spy.mockRestore();
    });
  });
});
