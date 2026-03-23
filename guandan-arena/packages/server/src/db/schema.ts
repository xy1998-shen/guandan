import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

/**
 * Agents 表 - 存储注册的 AI Agent 信息
 */
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  callbackUrl: text('callback_url').notNull(),
  apiToken: text('api_token').notNull().unique(),
  ownerId: text('owner_id'),
  createdAt: integer('created_at').notNull(),
  active: integer('active').notNull().default(1),
});

/**
 * Rooms 表 - 存储游戏房间信息
 */
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('waiting'),
  createdAt: integer('created_at').notNull(),
  config: text('config'), // JSON string
});

/**
 * Room Seats 表 - 存储房间座位信息
 */
export const roomSeats = sqliteTable(
  'room_seats',
  {
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id),
    seat: integer('seat').notNull(),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    team: text('team').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roomId, table.seat] }),
  })
);

/**
 * Games 表 - 存储游戏信息
 */
export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  roomId: text('room_id')
    .notNull()
    .references(() => rooms.id),
  status: text('status').notNull(),
  teamALevel: text('team_a_level').notNull().default('2'),
  teamBLevel: text('team_b_level').notNull().default('2'),
  winner: text('winner'),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
});

/**
 * Rounds 表 - 存储回合信息
 */
export const rounds = sqliteTable('rounds', {
  id: text('id').primaryKey(),
  gameId: text('game_id')
    .notNull()
    .references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  trumpRank: text('trump_rank').notNull(),
  finishOrder: text('finish_order').notNull(), // JSON array of seats
  levelChange: text('level_change'), // JSON object, nullable
});

/**
 * Plays 表 - 存储出牌记录
 */
export const plays = sqliteTable('plays', {
  id: text('id').primaryKey(),
  roundId: text('round_id')
    .notNull()
    .references(() => rounds.id),
  trickNumber: integer('trick_number').notNull(),
  seat: integer('seat').notNull(),
  comboType: text('combo_type').notNull(),
  cards: text('cards').notNull(), // JSON array
  timestamp: integer('timestamp').notNull(),
  // 新增统计字段
  responseTimeMs: integer('response_time_ms'), // Agent 出牌响应时间（毫秒）
  handCountBefore: integer('hand_count_before'), // 出牌前手牌数量
  isAutoPlay: integer('is_auto_play').default(0), // 是否自动出牌（掉线/超时时为1）
  isLeading: integer('is_leading').default(0), // 是否为首出（本轮第一个出牌）
  trickWinner: integer('trick_winner').default(0), // 该出牌是否赢得了本 trick（1=赢,0=没赢或还没结束）
});

/**
 * Leaderboard 表 - 存储排行榜数据
 */
export const leaderboard = sqliteTable('leaderboard', {
  agentId: text('agent_id')
    .primaryKey()
    .references(() => agents.id),
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
  roundsPlayed: integer('rounds_played').notNull().default(0),
  roundsWon: integer('rounds_won').notNull().default(0),
  winRate: real('win_rate').notNull().default(0),
  eloRating: integer('elo_rating').notNull().default(1000),
  // 新增统计字段
  avgResponseTimeMs: real('avg_response_time_ms').default(0), // 平均出牌响应时间
  bombTotal: integer('bomb_total').default(0), // 总炸弹出牌数
  bombSuccess: integer('bomb_success').default(0), // 成功压制的炸弹数
  riskScore: real('risk_score').default(0), // 风险偏好评分（0-100）
});

/**
 * Teammate Stats 表 - 存储队友配合统计
 */
export const teammateStats = sqliteTable(
  'teammate_stats',
  {
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    teammateId: text('teammate_id')
      .notNull()
      .references(() => agents.id),
    gamesPlayed: integer('games_played').default(0), // 一起的对局数
    gamesWon: integer('games_won').default(0), // 一起赢的对局数
    winRate: real('win_rate').default(0), // 配合胜率
  },
  (table) => ({
    pk: primaryKey({ columns: [table.agentId, table.teammateId] }),
  })
);

// 导出所有表用于 drizzle-kit 和类型推导
export const schema = {
  agents,
  rooms,
  roomSeats,
  games,
  rounds,
  plays,
  leaderboard,
  teammateStats,
};
