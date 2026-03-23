import { describe, it, expect, beforeEach } from 'vitest';
import type { Seat, Team, Combo } from '@guandan/shared';
import { ComboType, CARDS_PER_PLAYER } from '@guandan/shared';
import { Round, getTeamBySeat, getTeammate, type PlayerInit } from '../src/round.js';
import { makeCard, makeCards } from './helpers.js';

/**
 * 创建测试用的玩家列表
 */
function createTestPlayers(): PlayerInit[] {
  return [
    { seat: 0, agentId: 'agent-0', agentName: 'Player 0', team: 'A' },
    { seat: 1, agentId: 'agent-1', agentName: 'Player 1', team: 'B' },
    { seat: 2, agentId: 'agent-2', agentName: 'Player 2', team: 'A' },
    { seat: 3, agentId: 'agent-3', agentName: 'Player 3', team: 'B' },
  ];
}

describe('Round Helper Functions', () => {
  describe('getTeamBySeat', () => {
    it('should return team A for seats 0 and 2', () => {
      expect(getTeamBySeat(0)).toBe('A');
      expect(getTeamBySeat(2)).toBe('A');
    });

    it('should return team B for seats 1 and 3', () => {
      expect(getTeamBySeat(1)).toBe('B');
      expect(getTeamBySeat(3)).toBe('B');
    });
  });

  describe('getTeammate', () => {
    it('should return correct teammate for each seat', () => {
      expect(getTeammate(0)).toBe(2);
      expect(getTeammate(1)).toBe(3);
      expect(getTeammate(2)).toBe(0);
      expect(getTeammate(3)).toBe(1);
    });
  });
});

describe('Round', () => {
  let round: Round;
  let players: PlayerInit[];

  beforeEach(() => {
    players = createTestPlayers();
    round = new Round(players, '2');
  });

  describe('constructor', () => {
    it('should initialize round state correctly', () => {
      expect(round.state.trumpRank).toBe('2');
      expect(round.state.roundNumber).toBe(1);
      expect(round.state.status).toBe('dealing');
      expect(round.state.players).toHaveLength(4);
      expect(round.state.finishOrder).toHaveLength(0);
    });
  });

  describe('deal', () => {
    it('should deal 27 cards to each player', () => {
      round.deal();

      for (const player of round.state.players) {
        expect(player.hand).toHaveLength(CARDS_PER_PLAYER);
        expect(player.handCount).toBe(CARDS_PER_PLAYER);
      }
    });

    it('should set status to playing after deal', () => {
      round.deal();
      expect(round.state.status).toBe('playing');
    });

    it('should initialize currentTrick with seat 0 as lead', () => {
      round.deal();
      expect(round.state.currentTrick).not.toBeNull();
      expect(round.state.currentTrick!.leadSeat).toBe(0);
      expect(round.state.currentTrick!.currentSeat).toBe(0);
    });
  });

  describe('getCurrentSeat', () => {
    it('should return current seat when round is playing', () => {
      round.deal();
      expect(round.getCurrentSeat()).toBe(0);
    });
  });

  describe('isLeading', () => {
    it('should return true when no plays in current trick', () => {
      round.deal();
      expect(round.isLeading()).toBe(true);
    });

    it('should return false after a play', () => {
      round.deal();
      const player = round.state.players.find(p => p.seat === 0)!;
      const card = player.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      round.play(0, combo);
      expect(round.isLeading()).toBe(false);
    });
  });

  describe('play', () => {
    beforeEach(() => {
      round.deal();
    });

    it('should allow valid single card play on lead', () => {
      const player = round.state.players.find(p => p.seat === 0)!;
      const card = player.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      
      const result = round.play(0, combo);
      
      expect(result.valid).toBe(true);
      expect(player.handCount).toBe(CARDS_PER_PLAYER - 1);
    });

    it('should reject play when not your turn', () => {
      const player = round.state.players.find(p => p.seat === 1)!;
      const card = player.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      
      const result = round.play(1, combo);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('还没轮到');
    });

    it('should advance to next player after valid play', () => {
      const player = round.state.players.find(p => p.seat === 0)!;
      const card = player.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      
      round.play(0, combo);
      
      expect(round.getCurrentSeat()).toBe(1);
    });

    it('should record play in current trick', () => {
      const player = round.state.players.find(p => p.seat === 0)!;
      const card = player.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      
      round.play(0, combo);
      
      expect(round.state.currentTrick!.plays).toHaveLength(1);
      expect(round.state.currentTrick!.plays[0].seat).toBe(0);
    });

    it('should remove played cards from hand', () => {
      const player = round.state.players.find(p => p.seat === 0)!;
      const card = player.hand[0];
      const initialHandCount = player.hand.length;
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      
      round.play(0, combo);
      
      expect(player.hand).toHaveLength(initialHandCount - 1);
    });
  });

  describe('pass', () => {
    beforeEach(() => {
      round.deal();
    });

    it('should not allow pass on lead', () => {
      const result = round.pass(0);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('首出不能PASS');
    });

    it('should allow pass when following', () => {
      // First player plays a card
      const player0 = round.state.players.find(p => p.seat === 0)!;
      const card = player0.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      round.play(0, combo);

      // Second player passes
      const result = round.pass(1);
      
      expect(result.valid).toBe(true);
      expect(round.getCurrentSeat()).toBe(2);
    });

    it('should reject pass when not your turn', () => {
      // First player plays
      const player0 = round.state.players.find(p => p.seat === 0)!;
      const card = player0.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      round.play(0, combo);

      // Seat 2 tries to pass (should be seat 1's turn)
      const result = round.pass(2);
      
      expect(result.valid).toBe(false);
    });

    it('should end trick after 3 consecutive passes', () => {
      // Player 0 plays
      const player0 = round.state.players.find(p => p.seat === 0)!;
      const card = player0.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      round.play(0, combo);

      // Players 1, 2, 3 pass
      round.pass(1);
      round.pass(2);
      round.pass(3);

      // Player 0 should be the lead for new trick
      expect(round.state.currentTrick!.leadSeat).toBe(0);
      expect(round.isLeading()).toBe(true);
    });
  });

  describe('finish and finishOrder', () => {
    it('should mark player as finished when hand is empty', () => {
      round.deal();
      const player = round.state.players.find(p => p.seat === 0)!;

      // Play all cards one by one
      while (player.hand.length > 0) {
        const card = player.hand[0];
        const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
        
        if (round.getCurrentSeat() === 0) {
          round.play(0, combo);
        } else {
          // Others pass
          round.pass(round.getCurrentSeat()!);
        }
      }

      expect(player.finished).toBe(true);
      expect(round.state.finishOrder).toContain(0);
    });
  });

  describe('isRoundOver', () => {
    it('should return false at start', () => {
      round.deal();
      expect(round.isRoundOver()).toBe(false);
    });
  });

  describe('skip finished players', () => {
    it('should skip players who have finished', () => {
      round.deal();
      
      // Manually set player 1 as finished to test skipping
      const player1 = round.state.players.find(p => p.seat === 1)!;
      player1.finished = true;
      player1.hand = [];
      player1.handCount = 0;
      round.state.finishOrder.push(1);

      // Player 0 plays
      const player0 = round.state.players.find(p => p.seat === 0)!;
      const card = player0.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      round.play(0, combo);

      // Should skip seat 1 and go to seat 2
      expect(round.getCurrentSeat()).toBe(2);
    });
  });

  describe('teammate takes over lead', () => {
    it('should let teammate lead when leader finishes', () => {
      round.deal();
      
      // Set up: players 1 and 3 have finished
      const player1 = round.state.players.find(p => p.seat === 1)!;
      player1.finished = true;
      player1.hand = [];
      round.state.finishOrder.push(1);

      const player3 = round.state.players.find(p => p.seat === 3)!;
      player3.finished = true;
      player3.hand = [];
      round.state.finishOrder.push(3);

      // Player 0 plays
      const player0 = round.state.players.find(p => p.seat === 0)!;
      const card = player0.hand[0];
      const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
      round.play(0, combo);

      // Player 2 passes (only active follower)
      round.pass(2);

      // Trick should end, player 0 leads again (or if 0 finished, teammate takes over)
      expect(round.isLeading()).toBe(true);
    });
  });
});

describe('Round - Complete Game Simulation', () => {
  it('should complete a simple round with all players finishing', () => {
    const players = createTestPlayers();
    const round = new Round(players, '2');
    round.deal();

    let turnCount = 0;
    const maxTurns = 1000; // Safety limit

    while (!round.isRoundOver() && turnCount < maxTurns) {
      const seat = round.getCurrentSeat();
      if (seat === null) break;

      const player = round.state.players.find(p => p.seat === seat)!;
      
      if (round.isLeading()) {
        // Must play when leading
        if (player.hand.length > 0) {
          const card = player.hand[0];
          const combo: Combo = { type: ComboType.SINGLE, cards: [card], mainRank: card.rank };
          round.play(seat, combo);
        }
      } else {
        // Can pass when following
        round.pass(seat);
      }

      turnCount++;
    }

    expect(round.isRoundOver()).toBe(true);
    expect(round.getFinishOrder()).toHaveLength(4);
  });
});
