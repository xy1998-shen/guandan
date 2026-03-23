import { describe, it, expect, beforeEach } from 'vitest';
import type { Seat, Combo } from '@guandan/shared';
import { ComboType, INITIAL_LEVEL, CARDS_PER_PLAYER } from '@guandan/shared';
import { Game } from '../src/game.js';
import { type PlayerInit } from '../src/round.js';

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

describe('Game', () => {
  let game: Game;
  let players: PlayerInit[];

  beforeEach(() => {
    players = createTestPlayers();
    game = new Game('game-1', 'room-1', players);
  });

  describe('constructor', () => {
    it('should initialize game state correctly', () => {
      expect(game.state.gameId).toBe('game-1');
      expect(game.state.roomId).toBe('room-1');
      expect(game.state.status).toBe('waiting');
      expect(game.state.teamALevel).toBe(INITIAL_LEVEL);
      expect(game.state.teamBLevel).toBe(INITIAL_LEVEL);
      expect(game.state.currentRound).toBeNull();
      expect(game.state.roundHistory).toHaveLength(0);
      expect(game.state.winner).toBeNull();
    });

    it('should have initial level as "2"', () => {
      expect(game.state.teamALevel).toBe('2');
      expect(game.state.teamBLevel).toBe('2');
    });
  });

  describe('startNewRound', () => {
    it('should create and return a new round', () => {
      const round = game.startNewRound();
      
      expect(round).toBeDefined();
      expect(game.currentRound).toBe(round);
    });

    it('should set game status to playing', () => {
      game.startNewRound();
      
      expect(game.state.status).toBe('playing');
    });

    it('should deal cards to all players', () => {
      const round = game.startNewRound();
      
      for (const player of round.state.players) {
        expect(player.hand).toHaveLength(CARDS_PER_PLAYER);
      }
    });

    it('should use initial level as trump rank for first round', () => {
      const round = game.startNewRound();
      
      expect(round.state.trumpRank).toBe(INITIAL_LEVEL);
    });

    it('should update currentRound in game state', () => {
      game.startNewRound();
      
      expect(game.state.currentRound).not.toBeNull();
    });
  });

  describe('endRound', () => {
    beforeEach(() => {
      game.startNewRound();
    });

    it('should calculate correct result for Team A winning with 3 levels', () => {
      // Team A (seats 0, 2) gets 1st and 2nd
      const finishOrder: Seat[] = [0, 2, 1, 3];
      
      const result = game.endRound(finishOrder);
      
      expect(result.result.winningTeam).toBe('A');
      expect(result.result.levelUp).toBe(3);
      expect(game.state.teamALevel).toBe('5'); // 2 + 3 = 5
      expect(game.state.teamBLevel).toBe('2'); // unchanged
    });

    it('should calculate correct result for Team B winning with 2 levels', () => {
      // Team B (seats 1, 3) gets 1st and 3rd -> upgrade 2 levels
      const finishOrder: Seat[] = [1, 0, 3, 2];
      
      const result = game.endRound(finishOrder);
      
      expect(result.result.winningTeam).toBe('B');
      expect(result.result.levelUp).toBe(2);
      expect(game.state.teamBLevel).toBe('4'); // 2 + 2 = 4
      expect(game.state.teamALevel).toBe('2'); // unchanged
    });

    it('should add round to history', () => {
      const finishOrder: Seat[] = [0, 1, 2, 3];
      
      game.endRound(finishOrder);
      
      expect(game.state.roundHistory).toHaveLength(1);
    });

    it('should clear current round after ending', () => {
      const finishOrder: Seat[] = [0, 1, 2, 3];
      
      game.endRound(finishOrder);
      
      expect(game.currentRound).toBeNull();
      expect(game.state.currentRound).toBeNull();
    });

    it('should return gameOver=false when not passing A', () => {
      const finishOrder: Seat[] = [0, 1, 2, 3];
      
      const result = game.endRound(finishOrder);
      
      expect(result.gameOver).toBe(false);
      expect(result.winner).toBeUndefined();
    });
  });

  describe('game over scenarios', () => {
    it('should end game when a team passes A', () => {
      // Set Team A to K level
      game.state.teamALevel = 'K';
      game.startNewRound();
      
      // Team A wins with at least 1 level (passing A)
      const finishOrder: Seat[] = [0, 1, 2, 3];
      
      const result = game.endRound(finishOrder);
      
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('A');
      expect(game.state.status).toBe('finished');
      expect(game.state.winner).toBe('A');
    });

    it('should end game when Team B passes A', () => {
      // Set Team B to Q level (needs 3 to pass A)
      game.state.teamBLevel = 'Q';
      game.startNewRound();
      
      // Team B wins with 3 levels (双下)
      const finishOrder: Seat[] = [1, 3, 0, 2];
      
      const result = game.endRound(finishOrder);
      
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('B');
      expect(game.state.status).toBe('finished');
      expect(game.state.winner).toBe('B');
    });
  });

  describe('getState', () => {
    it('should return current game state', () => {
      const state = game.getState();
      
      expect(state).toBe(game.state);
      expect(state.gameId).toBe('game-1');
    });

    it('should sync currentRound state', () => {
      game.startNewRound();
      
      const state = game.getState();
      
      expect(state.currentRound).not.toBeNull();
      expect(state.currentRound?.roundNumber).toBe(1);
    });
  });

  describe('multiple rounds', () => {
    it('should use winning team level as trump rank for next round', () => {
      // First round
      game.startNewRound();
      // Team A wins with 3 levels
      game.endRound([0, 2, 1, 3]); // Team A: 2 -> 5
      
      // Second round should use Team A's level (5) as trump
      const round2 = game.startNewRound();
      
      expect(round2.state.trumpRank).toBe('5');
    });

    it('should track round numbers correctly', () => {
      const round1 = game.startNewRound();
      expect(round1.state.roundNumber).toBe(1);
      
      game.endRound([0, 1, 2, 3]);
      
      const round2 = game.startNewRound();
      expect(round2.state.roundNumber).toBe(2);
      
      game.endRound([1, 0, 2, 3]);
      
      const round3 = game.startNewRound();
      expect(round3.state.roundNumber).toBe(3);
    });

    it('should accumulate round history', () => {
      game.startNewRound();
      game.endRound([0, 1, 2, 3]);
      expect(game.state.roundHistory).toHaveLength(1);
      
      game.startNewRound();
      game.endRound([1, 0, 2, 3]);
      expect(game.state.roundHistory).toHaveLength(2);
      
      game.startNewRound();
      game.endRound([0, 2, 1, 3]);
      expect(game.state.roundHistory).toHaveLength(3);
    });
  });

  describe('complete game simulation', () => {
    it('should simulate a complete game until one team wins', () => {
      let roundCount = 0;
      const maxRounds = 50; // Safety limit

      while (game.state.status !== 'finished' && roundCount < maxRounds) {
        const round = game.startNewRound();
        
        // Simulate a simple round where seat 0 always wins first
        // Team A (0, 2) wins with 2 levels each round
        const finishOrder: Seat[] = [0, 1, 2, 3];
        const result = game.endRound(finishOrder);
        
        roundCount++;
        
        if (result.gameOver) {
          break;
        }
      }

      expect(game.state.status).toBe('finished');
      expect(game.state.winner).toBe('A');
      expect(game.state.teamALevel).toBe('A');
    });
  });
});
