import { describe, it, expect } from 'vitest';
import { isWildCard, separateWildCards, getWildCards } from '../src/wild-card.js';
import { makeCard, makeCards } from './helpers.js';
import type { Rank } from '@guandan/shared';

describe('wild-card', () => {
  describe('getWildCards', () => {
    it('should return H (hearts) as wild card suit', () => {
      const wild = getWildCards('2');
      expect(wild.suit).toBe('H');
      expect(wild.rank).toBe('2');
    });

    it('should use trump rank as wild card rank', () => {
      const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      
      for (const rank of ranks) {
        const wild = getWildCards(rank);
        expect(wild.suit).toBe('H');
        expect(wild.rank).toBe(rank);
      }
    });
  });

  describe('isWildCard', () => {
    it('should return true for heart trump rank', () => {
      // 级牌为 2 时，红心 2 是万能牌
      expect(isWildCard(makeCard('H', '2'), '2')).toBe(true);
      
      // 级牌为 A 时，红心 A 是万能牌
      expect(isWildCard(makeCard('H', 'A'), 'A')).toBe(true);
      
      // 级牌为 7 时，红心 7 是万能牌
      expect(isWildCard(makeCard('H', '7'), '7')).toBe(true);
    });

    it('should return false for non-heart trump rank', () => {
      // 黑桃级牌不是万能牌
      expect(isWildCard(makeCard('S', '2'), '2')).toBe(false);
      
      // 方块级牌不是万能牌
      expect(isWildCard(makeCard('D', '2'), '2')).toBe(false);
      
      // 梅花级牌不是万能牌
      expect(isWildCard(makeCard('C', '2'), '2')).toBe(false);
    });

    it('should return false for heart non-trump rank', () => {
      // 级牌为 2 时，红心 3 不是万能牌
      expect(isWildCard(makeCard('H', '3'), '2')).toBe(false);
      
      // 级牌为 2 时，红心 A 不是万能牌
      expect(isWildCard(makeCard('H', 'A'), '2')).toBe(false);
    });

    it('should return false for jokers (even with trump rank)', () => {
      // 小王不是万能牌
      expect(isWildCard(makeCard('JOKER', 'SMALL'), '2')).toBe(false);
      
      // 大王不是万能牌
      expect(isWildCard(makeCard('JOKER', 'BIG'), '2')).toBe(false);
    });

    it('should work with different trump ranks', () => {
      const trumpRanks: Rank[] = ['3', '5', '7', '10', 'J', 'K'];
      
      for (const trumpRank of trumpRanks) {
        // 红心级牌是万能牌
        expect(isWildCard(makeCard('H', trumpRank), trumpRank)).toBe(true);
        
        // 其他花色级牌不是万能牌
        expect(isWildCard(makeCard('S', trumpRank), trumpRank)).toBe(false);
        expect(isWildCard(makeCard('D', trumpRank), trumpRank)).toBe(false);
        expect(isWildCard(makeCard('C', trumpRank), trumpRank)).toBe(false);
      }
    });

    it('should handle both deck indices', () => {
      expect(isWildCard(makeCard('H', '2', 0), '2')).toBe(true);
      expect(isWildCard(makeCard('H', '2', 1), '2')).toBe(true);
    });
  });

  describe('separateWildCards', () => {
    it('should separate wild cards from normal cards', () => {
      const cards = makeCards(['H_2_0', 'H_2_1', 'S_3_0', 'D_4_0']);
      const { wilds, normals } = separateWildCards(cards, '2');
      
      expect(wilds.length).toBe(2);
      expect(normals.length).toBe(2);
    });

    it('should return empty wilds when no wild cards', () => {
      const cards = makeCards(['S_3_0', 'D_4_0', 'C_5_0']);
      const { wilds, normals } = separateWildCards(cards, '2');
      
      expect(wilds.length).toBe(0);
      expect(normals.length).toBe(3);
    });

    it('should return all as wilds when all are wild cards', () => {
      const cards = makeCards(['H_2_0', 'H_2_1']);
      const { wilds, normals } = separateWildCards(cards, '2');
      
      expect(wilds.length).toBe(2);
      expect(normals.length).toBe(0);
    });

    it('should correctly categorize wild cards', () => {
      const cards = makeCards(['H_2_0', 'S_2_0', 'D_2_0', 'C_2_0']);
      const { wilds, normals } = separateWildCards(cards, '2');
      
      // 只有红心 2 是万能牌
      expect(wilds.length).toBe(1);
      expect(wilds[0].suit).toBe('H');
      expect(wilds[0].rank).toBe('2');
      
      // 其他 2 是普通牌
      expect(normals.length).toBe(3);
    });

    it('should not treat jokers as wild cards', () => {
      const cards = makeCards(['JOKER_SMALL_0', 'JOKER_BIG_0', 'H_2_0']);
      const { wilds, normals } = separateWildCards(cards, '2');
      
      // 只有红心 2 是万能牌
      expect(wilds.length).toBe(1);
      
      // 王牌归入普通牌
      expect(normals.length).toBe(2);
    });

    it('should handle empty array', () => {
      const { wilds, normals } = separateWildCards([], '2');
      
      expect(wilds.length).toBe(0);
      expect(normals.length).toBe(0);
    });

    it('should work with different trump ranks', () => {
      // 级牌为 A 时
      const cards = makeCards(['H_A_0', 'H_A_1', 'S_A_0', 'H_2_0']);
      const { wilds, normals } = separateWildCards(cards, 'A');
      
      // 只有红心 A 是万能牌
      expect(wilds.length).toBe(2);
      expect(normals.length).toBe(2);
    });

    it('should preserve card properties', () => {
      const cards = makeCards(['H_2_0', 'S_3_1']);
      const { wilds, normals } = separateWildCards(cards, '2');
      
      expect(wilds[0]).toEqual({ suit: 'H', rank: '2', deckIndex: 0 });
      expect(normals[0]).toEqual({ suit: 'S', rank: '3', deckIndex: 1 });
    });
  });
});
