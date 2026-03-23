import { describe, it, expect } from 'vitest';
import { createDeck, shuffle, dealCards } from '../src/deck.js';
import type { Suit, Rank } from '@guandan/shared';

describe('deck', () => {
  describe('createDeck', () => {
    it('should create 108 cards (two decks)', () => {
      const deck = createDeck();
      expect(deck.length).toBe(108);
    });

    it('should have correct suit distribution', () => {
      const deck = createDeck();
      const suits: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0, JOKER: 0 };
      
      for (const card of deck) {
        suits[card.suit]++;
      }
      
      // 每花色 13 点数 * 2 副牌 = 26 张
      expect(suits.S).toBe(26);
      expect(suits.H).toBe(26);
      expect(suits.D).toBe(26);
      expect(suits.C).toBe(26);
      // 大小王各 2 张 = 4 张
      expect(suits.JOKER).toBe(4);
    });

    it('should have 2 cards for each rank of each suit (two decks)', () => {
      const deck = createDeck();
      const normalRanks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
      const suits: Suit[] = ['S', 'H', 'D', 'C'];
      
      for (const suit of suits) {
        for (const rank of normalRanks) {
          const count = deck.filter(c => c.suit === suit && c.rank === rank).length;
          expect(count).toBe(2);
        }
      }
    });

    it('should have 2 small jokers and 2 big jokers', () => {
      const deck = createDeck();
      
      const smallJokers = deck.filter(c => c.suit === 'JOKER' && c.rank === 'SMALL');
      const bigJokers = deck.filter(c => c.suit === 'JOKER' && c.rank === 'BIG');
      
      expect(smallJokers.length).toBe(2);
      expect(bigJokers.length).toBe(2);
    });

    it('should have correct deckIndex (0 and 1)', () => {
      const deck = createDeck();
      
      const deck0 = deck.filter(c => c.deckIndex === 0);
      const deck1 = deck.filter(c => c.deckIndex === 1);
      
      expect(deck0.length).toBe(54);
      expect(deck1.length).toBe(54);
    });
  });

  describe('shuffle', () => {
    it('should return same length', () => {
      const deck = createDeck();
      const shuffled = shuffle(deck);
      
      expect(shuffled.length).toBe(deck.length);
    });

    it('should contain all original cards', () => {
      const deck = createDeck();
      const shuffled = shuffle(deck);
      
      // 检查每张牌都存在
      for (const card of deck) {
        const found = shuffled.some(
          c => c.suit === card.suit && c.rank === card.rank && c.deckIndex === card.deckIndex
        );
        expect(found).toBe(true);
      }
    });

    it('should not modify original array', () => {
      const deck = createDeck();
      const originalFirst = deck[0];
      const originalLast = deck[deck.length - 1];
      
      shuffle(deck);
      
      expect(deck[0]).toBe(originalFirst);
      expect(deck[deck.length - 1]).toBe(originalLast);
    });

    it('should produce different order (with high probability)', () => {
      const deck = createDeck();
      const shuffled = shuffle(deck);
      
      // 计算相同位置的牌数量
      let samePosition = 0;
      for (let i = 0; i < deck.length; i++) {
        if (
          deck[i].suit === shuffled[i].suit &&
          deck[i].rank === shuffled[i].rank &&
          deck[i].deckIndex === shuffled[i].deckIndex
        ) {
          samePosition++;
        }
      }
      
      // 洗牌后不应该所有牌都在相同位置（概率极低）
      expect(samePosition).toBeLessThan(deck.length);
    });
  });

  describe('dealCards', () => {
    it('should deal 27 cards to each player', () => {
      const deck = createDeck();
      const hands = dealCards(deck);
      
      expect(hands[0].length).toBe(27);
      expect(hands[1].length).toBe(27);
      expect(hands[2].length).toBe(27);
      expect(hands[3].length).toBe(27);
    });

    it('should distribute all 108 cards', () => {
      const deck = createDeck();
      const hands = dealCards(deck);
      
      const totalCards = hands[0].length + hands[1].length + hands[2].length + hands[3].length;
      expect(totalCards).toBe(108);
    });

    it('should distribute cards in round-robin fashion', () => {
      const deck = createDeck();
      const hands = dealCards(deck);
      
      // 玩家 0 应该得到第 0, 4, 8, ... 张牌
      expect(hands[0][0]).toBe(deck[0]);
      expect(hands[0][1]).toBe(deck[4]);
      expect(hands[0][2]).toBe(deck[8]);
      
      // 玩家 1 应该得到第 1, 5, 9, ... 张牌
      expect(hands[1][0]).toBe(deck[1]);
      expect(hands[1][1]).toBe(deck[5]);
      expect(hands[1][2]).toBe(deck[9]);
      
      // 玩家 2 应该得到第 2, 6, 10, ... 张牌
      expect(hands[2][0]).toBe(deck[2]);
      expect(hands[2][1]).toBe(deck[6]);
      expect(hands[2][2]).toBe(deck[10]);
      
      // 玩家 3 应该得到第 3, 7, 11, ... 张牌
      expect(hands[3][0]).toBe(deck[3]);
      expect(hands[3][1]).toBe(deck[7]);
      expect(hands[3][2]).toBe(deck[11]);
    });

    it('should not have duplicate cards across players', () => {
      const deck = shuffle(createDeck());
      const hands = dealCards(deck);
      
      const allCards = [...hands[0], ...hands[1], ...hands[2], ...hands[3]];
      const cardIds = new Set(allCards.map(c => `${c.suit}_${c.rank}_${c.deckIndex}`));
      
      expect(cardIds.size).toBe(108);
    });
  });
});
