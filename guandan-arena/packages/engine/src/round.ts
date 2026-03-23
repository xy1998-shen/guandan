import type { Card, Rank, Combo, Seat, Team, RoundState, PlayerState, TrickPlay } from '@guandan/shared';
import { ComboType, getCardId } from '@guandan/shared';
import { createDeck, shuffle, dealCards } from './deck.js';
import { validatePlay } from './validator.js';

/**
 * 玩家初始化参数
 */
export interface PlayerInit {
  seat: Seat;
  agentId: string;
  agentName: string;
  team: Team;
}

/**
 * 根据座位号获取所属队伍
 */
export function getTeamBySeat(seat: Seat): Team {
  return seat % 2 === 0 ? 'A' : 'B';
}

/**
 * 获取队友的座位号
 */
export function getTeammate(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}

/**
 * 获取下一个座位号（逆时针: 0 -> 1 -> 2 -> 3 -> 0）
 */
function getNextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

/**
 * 单局回合管理类
 */
export class Round {
  state: RoundState;

  constructor(players: PlayerInit[], trumpRank: Rank, roundNumber: number = 1) {
    // 初始化玩家状态
    const playerStates: PlayerState[] = players.map((p) => ({
      seat: p.seat,
      agentId: p.agentId,
      agentName: p.agentName,
      team: p.team,
      hand: [],
      handCount: 0,
      finished: false,
      finishOrder: null,
    }));

    this.state = {
      roundNumber,
      trumpRank,
      status: 'dealing',
      players: playerStates,
      currentTrick: null,
      finishOrder: [],
      trickHistory: [],
    };
  }

  /**
   * 发牌
   */
  deal(): void {
    const deck = createDeck();
    const shuffledDeck = shuffle(deck);
    const hands = dealCards(shuffledDeck);

    // 按座位顺序分配手牌
    for (let i = 0; i < 4; i++) {
      const player = this.state.players.find((p) => p.seat === i);
      if (player) {
        player.hand = hands[i];
        player.handCount = hands[i].length;
      }
    }

    // 初始化第一个 trick，座位0先出
    this.state.currentTrick = {
      plays: [],
      leadSeat: 0,
      currentSeat: 0,
      passCount: 0,
    };

    this.state.status = 'playing';
  }

  /**
   * 获取当前应该出牌的座位
   */
  getCurrentSeat(): Seat | null {
    if (this.isRoundOver()) {
      return null;
    }
    return this.state.currentTrick?.currentSeat ?? null;
  }

  /**
   * 是否是新trick的首出
   */
  isLeading(): boolean {
    if (!this.state.currentTrick) return true;
    return this.state.currentTrick.plays.length === 0;
  }

  /**
   * 获取玩家状态
   */
  private getPlayer(seat: Seat): PlayerState | undefined {
    return this.state.players.find((p) => p.seat === seat);
  }

  /**
   * 获取下一个未出完的玩家座位
   */
  private getNextActiveSeat(currentSeat: Seat): Seat {
    let next = getNextSeat(currentSeat);
    // 跳过已出完的玩家
    while (this.getPlayer(next)?.finished) {
      next = getNextSeat(next);
      // 安全检查，防止无限循环
      if (next === currentSeat) break;
    }
    return next;
  }

  /**
   * 获取当前 trick 最后一个有效出牌（非 PASS）
   */
  private getLastValidPlay(): TrickPlay | null {
    if (!this.state.currentTrick) return null;
    const plays = this.state.currentTrick.plays;
    for (let i = plays.length - 1; i >= 0; i--) {
      if (plays[i].combo.type !== ComboType.PASS) {
        return plays[i];
      }
    }
    return null;
  }

  /**
   * 从手牌中移除指定的牌
   */
  private removeCardsFromHand(player: PlayerState, cards: Card[]): void {
    // 手牌中每张牌 ID 唯一，可通过一次 filter 在 O(n) 完成删除
    const removeIds = new Set(cards.map(getCardId));
    player.hand = player.hand.filter((card) => !removeIds.has(getCardId(card)));
    player.handCount = player.hand.length;
  }

  /**
   * 标记玩家出完
   */
  private markPlayerFinished(player: PlayerState): void {
    player.finished = true;
    player.finishOrder = this.state.finishOrder.length + 1; // 1-based
    this.state.finishOrder.push(player.seat);
  }

  /**
   * 结束当前 trick，开始新的 trick
   */
  private endCurrentTrick(nextLeadSeat: Seat): void {
    if (this.state.currentTrick) {
      this.state.trickHistory.push(this.state.currentTrick);
    }

    // 如果领出者已出完，由队友接替
    let leadSeat = nextLeadSeat;
    const leadPlayer = this.getPlayer(leadSeat);
    if (leadPlayer?.finished) {
      const teammateSeat = getTeammate(leadSeat);
      const teammate = this.getPlayer(teammateSeat);
      if (teammate && !teammate.finished) {
        leadSeat = teammateSeat;
      } else {
        // 如果队友也出完了，找下一个未出完的人
        leadSeat = this.getNextActiveSeat(leadSeat);
      }
    }

    // 创建新的 trick
    this.state.currentTrick = {
      plays: [],
      leadSeat,
      currentSeat: leadSeat,
      passCount: 0,
    };
  }

  /**
   * 出牌
   */
  play(seat: Seat, combo: Combo): { valid: boolean; reason?: string } {
    // 检查是否轮到该玩家
    if (this.getCurrentSeat() !== seat) {
      return { valid: false, reason: '还没轮到你出牌' };
    }

    const player = this.getPlayer(seat);
    if (!player) {
      return { valid: false, reason: '找不到玩家' };
    }

    if (player.finished) {
      return { valid: false, reason: '你已经出完牌了' };
    }

    // 调用 validator 校验合法性
    const validateResult = validatePlay(
      combo.cards,
      player.hand,
      this.state.currentTrick,
      this.state.trumpRank
    );

    if (!validateResult.valid) {
      return { valid: false, reason: validateResult.reason };
    }

    // 记录出牌
    const trickPlay: TrickPlay = {
      seat,
      combo: validateResult.combo!,
      timestamp: Date.now(),
    };
    this.state.currentTrick!.plays.push(trickPlay);
    this.state.currentTrick!.passCount = 0;

    // 从手牌移除
    this.removeCardsFromHand(player, combo.cards);

    // 检查是否出完
    if (player.hand.length === 0) {
      this.markPlayerFinished(player);
    }

    // 检查本局是否结束
    if (this.isRoundOver()) {
      this.state.status = 'finished';
      // 自动标记最后一人为末游
      this.finalizeFinishOrder();
      return { valid: true };
    }

    // 推进到下一位玩家
    const nextSeat = this.getNextActiveSeat(seat);
    this.state.currentTrick!.currentSeat = nextSeat;

    return { valid: true };
  }

  /**
   * PASS
   */
  pass(seat: Seat): { valid: boolean; reason?: string } {
    // 检查是否轮到该玩家
    if (this.getCurrentSeat() !== seat) {
      return { valid: false, reason: '还没轮到你出牌' };
    }

    // 首出不能 PASS
    if (this.isLeading()) {
      return { valid: false, reason: '首出不能PASS' };
    }

    const player = this.getPlayer(seat);
    if (!player) {
      return { valid: false, reason: '找不到玩家' };
    }

    if (player.finished) {
      return { valid: false, reason: '你已经出完牌了' };
    }

    // 记录 PASS
    const passCombo: Combo = {
      type: ComboType.PASS,
      cards: [],
    };
    const trickPlay: TrickPlay = {
      seat,
      combo: passCombo,
      timestamp: Date.now(),
    };
    this.state.currentTrick!.plays.push(trickPlay);
    this.state.currentTrick!.passCount++;

    // 统计连续 PASS 数量（不包括已出完的玩家）
    const activePlayersCount = this.state.players.filter((p) => !p.finished).length;
    
    // 计算需要多少连续PASS才结束trick
    // 如果有人出牌后，其他所有活跃玩家都PASS，则trick结束
    const lastValidPlay = this.getLastValidPlay();
    if (lastValidPlay) {
      // 统计从上一个有效出牌之后的PASS数量
      let passCountAfterLastPlay = 0;
      const plays = this.state.currentTrick!.plays;
      for (let i = plays.length - 1; i >= 0; i--) {
        if (plays[i].combo.type === ComboType.PASS) {
          // 只计算未出完玩家的PASS
          const passPlayer = this.getPlayer(plays[i].seat);
          if (passPlayer && !passPlayer.finished) {
            passCountAfterLastPlay++;
          }
        } else {
          break;
        }
      }

      // 如果 PASS 数量 >= 活跃玩家数 - 1（除了最后出牌的人），trick 结束
      const needPasses = activePlayersCount - 1;
      if (passCountAfterLastPlay >= needPasses) {
        // trick 结束，最后出牌的人成为新 trick 的首出
        this.endCurrentTrick(lastValidPlay.seat);
        return { valid: true };
      }
    }

    // 推进到下一位玩家
    const nextSeat = this.getNextActiveSeat(seat);
    this.state.currentTrick!.currentSeat = nextSeat;

    return { valid: true };
  }

  /**
   * 判断本局是否结束
   * 3人出完时本局结束（第4人自动成为末游）
   * 或同一队两人都出完时也结束
   */
  isRoundOver(): boolean {
    const finishedCount = this.state.finishOrder.length;
    
    // 3人出完，本局结束
    if (finishedCount >= 3) {
      return true;
    }

    // 检查是否同队双下
    if (finishedCount >= 2) {
      const firstFinisher = this.getPlayer(this.state.finishOrder[0]);
      const secondFinisher = this.getPlayer(this.state.finishOrder[1]);
      if (firstFinisher && secondFinisher && firstFinisher.team === secondFinisher.team) {
        return true;
      }
    }

    return false;
  }

  /**
   * 确保出完顺序完整（自动标记末游）
   */
  private finalizeFinishOrder(): void {
    // 找出还没出完的玩家并标记为末游
    for (const player of this.state.players) {
      if (!player.finished) {
        this.markPlayerFinished(player);
      }
    }
  }

  /**
   * 获取出完顺序
   */
  getFinishOrder(): Seat[] {
    return [...this.state.finishOrder];
  }
}
