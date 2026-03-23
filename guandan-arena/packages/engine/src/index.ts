// 牌组操作
export { createDeck, shuffle, dealCards } from './deck.js';

// 万能牌逻辑
export { getWildCards, isWildCard, separateWildCards } from './wild-card.js';

// 牌型识别
export { detectCombo } from './combo-detector.js';

// 牌型比较
export { compareCombo, canBeat } from './combo-comparator.js';

// 出牌校验
export { validatePlay, hasPlayableCards } from './validator.js';
export type { ValidateResult } from './validator.js';

// 单局回合管理
export { Round, getTeamBySeat, getTeammate } from './round.js';
export type { PlayerInit } from './round.js';

// 升级计分
export { calculateRoundResult, advanceLevel } from './scoring.js';
export type { RoundResult, AdvanceLevelResult } from './scoring.js';

// 多局游戏管理
export { Game } from './game.js';
export type { EndRoundResult } from './game.js';
