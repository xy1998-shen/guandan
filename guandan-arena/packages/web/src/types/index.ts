import type { Suit, Card, Rank } from '../../../shared/src/index.js';
import { ComboType } from '../../../shared/src/index.js';

export type {
  Suit,
  Rank,
  Card,
  Combo,
  Team,
  Seat,
  GameStatus,
  RoundStatus,
  PlayerState,
  TrickPlay,
  Trick,
  RoundState,
  GameState,
  RoomStatus,
  RoomSeat,
  Room,
  WsMessageType,
  WsMessage,
  ApiResponse,
} from '../../../shared/src/index.js';

export { ComboType, getCardId, RANK_ORDER } from '../../../shared/src/index.js';

// ========== Leaderboard Types ==========
export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  eloScore: number;
  roundsPlayed: number;
  roundsWon: number;
  roundWinRate: number;
  bombRate: number;
  avgPlayIntervalMs: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  todayGames: number;
}

export interface AgentStatsResponse {
  agentId: string;
  agentName: string;
  eloScore: number;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  roundsPlayed: number;
  roundsWon: number;
  roundWinRate: number;
  eloTrend: number[];
  opponents: Array<{ opponent: string; games: number; wins: number; winRate: number }>;
}

export interface AgentGameItem {
  gameId: string;
  winner: string | null;
  selfTeam: 'A' | 'B';
  result: 'win' | 'lose';
  teamALevel: string;
  teamBLevel: string;
  startedAt: number;
  finishedAt: number | null;
  players: Array<{ agentId: string; agentName: string; team: 'A' | 'B' }>;
}

export interface RecentGameItem {
  gameId: string;
  roomId: string;
  winner: string | null;
  teamALevel: string;
  teamBLevel: string;
  startedAt: number;
  finishedAt: number | null;
  players: Array<{ seat: number; team: 'A' | 'B'; agentId: string; agentName: string }>;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
  JOKER: '★',
};

export const SUIT_COLORS: Record<Suit, string> = {
  S: 'black',
  H: 'red',
  D: 'red',
  C: 'black',
  JOKER: 'special',
};

/** 判断牌型是否为炸弹 */
export function isBomb(type: ComboType): boolean {
  return [
    ComboType.BOMB_4,
    ComboType.BOMB_5,
    ComboType.BOMB_6,
    ComboType.BOMB_7,
    ComboType.BOMB_8,
    ComboType.STRAIGHT_FLUSH,
    ComboType.ROCKET,
  ].includes(type);
}

/** 判断是否为万能牌（红心级牌） */
export function isWildCard(card: Card, trumpRank: Rank): boolean {
  return card.suit === 'H' && card.rank === trumpRank;
}
