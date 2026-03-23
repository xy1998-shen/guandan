import { describe, it, expect } from 'vitest';
import type { Seat } from '@guandan/shared';
import { calculateRoundResult, advanceLevel } from '../src/scoring.js';

describe('calculateRoundResult', () => {
  describe('level up calculation', () => {
    it('should upgrade 3 levels when same team gets 1st and 2nd (双下对手)', () => {
      // Team A (seats 0, 2) gets 1st and 2nd
      // Team B (seats 1, 3) gets 3rd and 4th
      const finishOrder: Seat[] = [0, 2, 1, 3];
      
      const result = calculateRoundResult(finishOrder);
      
      expect(result.winningTeam).toBe('A');
      expect(result.levelUp).toBe(3);
    });

    it('should upgrade 3 levels when Team B gets 1st and 2nd', () => {
      // Team B (seats 1, 3) gets 1st and 2nd
      const finishOrder: Seat[] = [1, 3, 0, 2];
      
      const result = calculateRoundResult(finishOrder);
      
      expect(result.winningTeam).toBe('B');
      expect(result.levelUp).toBe(3);
    });

    it('should upgrade 2 levels when same team gets 1st and 3rd', () => {
      // Team A gets 1st and 3rd: seat 0 first, opponent seat 1 second, teammate seat 2 third
      const finishOrder: Seat[] = [0, 1, 2, 3];
      
      const result = calculateRoundResult(finishOrder);
      
      expect(result.winningTeam).toBe('A');
      expect(result.levelUp).toBe(2);
    });

    it('should upgrade 2 levels when Team B gets 1st and 3rd', () => {
      // Team B gets 1st (seat 1), opponent 2nd (seat 0), teammate 3rd (seat 3)
      const finishOrder: Seat[] = [1, 0, 3, 2];
      
      const result = calculateRoundResult(finishOrder);
      
      expect(result.winningTeam).toBe('B');
      expect(result.levelUp).toBe(2);
    });

    it('should upgrade 1 level when teammate is 4th (末游)', () => {
      // Team A's seat 0 is 1st, Team B's 1 and 3 are 2nd/3rd, Team A's seat 2 is 4th
      const finishOrder: Seat[] = [0, 1, 3, 2];
      
      const result = calculateRoundResult(finishOrder);
      
      expect(result.winningTeam).toBe('A');
      expect(result.levelUp).toBe(1);
    });

    it('should upgrade 1 level when Team B wins but teammate is 4th', () => {
      // Team B's seat 1 is 1st, opponents are 2nd/3rd, teammate seat 3 is 4th
      const finishOrder: Seat[] = [1, 0, 2, 3];
      
      const result = calculateRoundResult(finishOrder);
      
      expect(result.winningTeam).toBe('B');
      expect(result.levelUp).toBe(1);
    });
  });

  describe('winning team determination', () => {
    it('should determine winning team by first place seat', () => {
      // Seat 0 (Team A) finishes first
      const result1 = calculateRoundResult([0, 1, 2, 3]);
      expect(result1.winningTeam).toBe('A');

      // Seat 1 (Team B) finishes first
      const result2 = calculateRoundResult([1, 0, 2, 3]);
      expect(result2.winningTeam).toBe('B');

      // Seat 2 (Team A) finishes first
      const result3 = calculateRoundResult([2, 1, 0, 3]);
      expect(result3.winningTeam).toBe('A');

      // Seat 3 (Team B) finishes first
      const result4 = calculateRoundResult([3, 0, 1, 2]);
      expect(result4.winningTeam).toBe('B');
    });
  });

  describe('error handling', () => {
    it('should throw error if finishOrder has less than 4 seats', () => {
      expect(() => calculateRoundResult([0, 1, 2])).toThrow();
      expect(() => calculateRoundResult([0, 1])).toThrow();
      expect(() => calculateRoundResult([0])).toThrow();
      expect(() => calculateRoundResult([])).toThrow();
    });
  });
});

describe('advanceLevel', () => {
  describe('normal advancement', () => {
    it('should advance from 2 correctly', () => {
      expect(advanceLevel('2', 1)).toEqual({ newLevel: '3', passedA: false });
      expect(advanceLevel('2', 2)).toEqual({ newLevel: '4', passedA: false });
      expect(advanceLevel('2', 3)).toEqual({ newLevel: '5', passedA: false });
    });

    it('should advance from middle levels correctly', () => {
      expect(advanceLevel('5', 1)).toEqual({ newLevel: '6', passedA: false });
      expect(advanceLevel('7', 2)).toEqual({ newLevel: '9', passedA: false });
      expect(advanceLevel('10', 1)).toEqual({ newLevel: 'J', passedA: false });
      expect(advanceLevel('J', 1)).toEqual({ newLevel: 'Q', passedA: false });
      expect(advanceLevel('Q', 1)).toEqual({ newLevel: 'K', passedA: false });
    });

    it('should advance from K to A', () => {
      expect(advanceLevel('K', 1)).toEqual({ newLevel: 'A', passedA: true });
    });
  });

  describe('passing A (winning)', () => {
    it('should mark passedA=true when reaching A', () => {
      const result = advanceLevel('K', 1);
      expect(result.passedA).toBe(true);
      expect(result.newLevel).toBe('A');
    });

    it('should mark passedA=true when exceeding A', () => {
      // From K, advancing 2 steps would go past A
      const result = advanceLevel('K', 2);
      expect(result.passedA).toBe(true);
      expect(result.newLevel).toBe('A');
    });

    it('should mark passedA=true when jumping to A from lower levels', () => {
      // From Q (index 10), +3 = 13 (A's index is 12)
      const result = advanceLevel('Q', 3);
      expect(result.passedA).toBe(true);
      expect(result.newLevel).toBe('A');
    });

    it('should mark passedA=true when jumping past A with large steps', () => {
      // From 10 (index 8), +6 = 14 (past A's index of 12)
      const result = advanceLevel('10', 6);
      expect(result.passedA).toBe(true);
      expect(result.newLevel).toBe('A');
    });
  });

  describe('edge cases', () => {
    it('should handle advancing by 0 steps', () => {
      expect(advanceLevel('5', 0)).toEqual({ newLevel: '5', passedA: false });
    });

    it('should throw error for invalid level', () => {
      expect(() => advanceLevel('SMALL' as any, 1)).toThrow();
      expect(() => advanceLevel('BIG' as any, 1)).toThrow();
    });
  });

  describe('complete game scenarios', () => {
    it('should simulate multiple rounds of advancement', () => {
      // Start at 2
      let level = '2';
      
      // Round 1: win by 3 levels
      let result = advanceLevel(level as any, 3);
      expect(result).toEqual({ newLevel: '5', passedA: false });
      level = result.newLevel;
      
      // Round 2: win by 2 levels
      result = advanceLevel(level as any, 2);
      expect(result).toEqual({ newLevel: '7', passedA: false });
      level = result.newLevel;
      
      // Round 3: win by 1 level
      result = advanceLevel(level as any, 1);
      expect(result).toEqual({ newLevel: '8', passedA: false });
      level = result.newLevel;
      
      // Round 4: win by 3 levels
      result = advanceLevel(level as any, 3);
      expect(result).toEqual({ newLevel: 'J', passedA: false });
      level = result.newLevel;
      
      // Round 5: win by 3 levels (should pass A)
      result = advanceLevel(level as any, 3);
      expect(result.passedA).toBe(true);
      expect(result.newLevel).toBe('A');
    });
  });
});
