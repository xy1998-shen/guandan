import type { Rank } from '../types/card.js';

/**
 * Agent 出牌超时时间 (ms)
 */
export const TURN_TIMEOUT = 10000;

/**
 * 每步之间的延迟时间 (ms)
 */
export const STEP_DELAY = 1500;

/**
 * 连续超时次数达到此值判定掉线
 */
export const MAX_TIMEOUT_COUNT = 3;

/**
 * 连续违规次数达到此值判负
 */
export const MAX_VIOLATION_COUNT = 5;

/**
 * 每人发牌数量 (108 / 4 = 27)
 */
export const CARDS_PER_PLAYER = 27;

/**
 * 两副牌共计牌数
 */
export const TOTAL_CARDS = 108;

/**
 * 起始级数
 */
export const INITIAL_LEVEL: Rank = '2';

/**
 * 获胜级数 (过A获胜)
 */
export const WIN_LEVEL: Rank = 'A';
