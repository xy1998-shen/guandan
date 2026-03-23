import type { Rank, Seat, Team, GameState } from '@guandan/shared';
import { INITIAL_LEVEL } from '@guandan/shared';
import { Round, type PlayerInit } from './round.js';
import { calculateRoundResult, advanceLevel, type RoundResult } from './scoring.js';

/**
 * 一局结束后的处理结果
 */
export interface EndRoundResult {
  /** 本局结果 */
  result: RoundResult;
  /** 游戏是否结束 */
  gameOver: boolean;
  /** 获胜队伍（游戏结束时有值） */
  winner?: Team;
}

/**
 * 多局游戏管理类
 */
export class Game {
  state: GameState;
  currentRound: Round | null = null;
  private players: PlayerInit[];

  constructor(
    gameId: string,
    roomId: string,
    players: PlayerInit[]
  ) {
    this.players = players;

    this.state = {
      gameId,
      roomId,
      status: 'waiting',
      teamALevel: INITIAL_LEVEL,
      teamBLevel: INITIAL_LEVEL,
      currentRound: null,
      roundHistory: [],
      winner: null,
    };
  }

  /**
   * 获取当前级牌
   * 首局使用 Team A 的级数，之后使用获胜队伍的级数
   */
  private getCurrentTrumpRank(): Rank {
    // 首局使用初始级数（2）
    if (this.state.roundHistory.length === 0) {
      return INITIAL_LEVEL;
    }
    
    // 查看上一局的获胜队伍，使用该队伍的当前级数
    const lastRound = this.state.roundHistory[this.state.roundHistory.length - 1];
    if (lastRound.finishOrder.length > 0) {
      const firstPlaceSeat = lastRound.finishOrder[0];
      // 座位 0,2 是 A 队，座位 1,3 是 B 队
      const winningTeam: Team = firstPlaceSeat % 2 === 0 ? 'A' : 'B';
      return winningTeam === 'A' ? this.state.teamALevel : this.state.teamBLevel;
    }
    
    // 默认返回 A 队级数
    return this.state.teamALevel;
  }

  /**
   * 开始新一局
   */
  startNewRound(): Round {
    const roundNumber = this.state.roundHistory.length + 1;
    const trumpRank = this.getCurrentTrumpRank();

    // 创建 Round 实例
    this.currentRound = new Round(this.players, trumpRank, roundNumber);
    
    // 发牌
    this.currentRound.deal();

    // 更新游戏状态
    this.state.status = 'playing';
    this.state.currentRound = this.currentRound.state;

    return this.currentRound;
  }

  /**
   * 一局结束后处理
   */
  endRound(finishOrder: Seat[]): EndRoundResult {
    // 计算本局结果
    const result = calculateRoundResult(finishOrder);

    // 更新获胜队伍的级数
    const currentLevel = result.winningTeam === 'A' 
      ? this.state.teamALevel 
      : this.state.teamBLevel;
    
    const advanceResult = advanceLevel(currentLevel, result.levelUp);

    if (result.winningTeam === 'A') {
      this.state.teamALevel = advanceResult.newLevel;
    } else {
      this.state.teamBLevel = advanceResult.newLevel;
    }

    // 保存本局状态到历史
    if (this.currentRound) {
      this.state.roundHistory.push({ ...this.currentRound.state });
    }

    // 判断游戏是否结束
    const gameOver = advanceResult.passedA;

    if (gameOver) {
      this.state.status = 'finished';
      this.state.winner = result.winningTeam;
    }

    // 清理当前局
    this.state.currentRound = null;
    this.currentRound = null;

    return {
      result,
      gameOver,
      winner: gameOver ? result.winningTeam : undefined,
    };
  }

  /**
   * 获取游戏状态
   */
  getState(): GameState {
    // 同步 currentRound 状态
    if (this.currentRound) {
      this.state.currentRound = this.currentRound.state;
    }
    return this.state;
  }
}
