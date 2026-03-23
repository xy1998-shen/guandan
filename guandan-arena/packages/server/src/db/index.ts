import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径: packages/server/data/guandan.db
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = path.join(dataDir, 'guandan.db');

// 确保 data 目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建 SQLite 连接
const sqlite = new Database(dbPath);

// 启用 WAL 模式和设置 busy_timeout 以支持并发读写
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

// 创建 Drizzle 实例
export const db = drizzle(sqlite, { schema });

/**
 * 初始化数据库表
 * 使用 SQL 直接创建表，等价于 drizzle-kit push
 */
export function initDatabase(): void {
  console.log(`[DB] Initializing database at ${dbPath}`);

  // 创建 agents 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      callback_url TEXT NOT NULL,
      api_token TEXT NOT NULL UNIQUE,
      owner_id TEXT,
      created_at INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )
  `);

  // 向后兼容：旧库可能缺少 owner_id 列
  const agentColumns = sqlite
    .prepare('PRAGMA table_info(agents)')
    .all() as Array<{ name: string }>;
  if (!agentColumns.some((column) => column.name === 'owner_id')) {
    sqlite.exec('ALTER TABLE agents ADD COLUMN owner_id TEXT');
  }

  // 创建 rooms 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      created_at INTEGER NOT NULL,
      config TEXT
    )
  `);

  // 创建 room_seats 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS room_seats (
      room_id TEXT NOT NULL REFERENCES rooms(id),
      seat INTEGER NOT NULL,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      team TEXT NOT NULL,
      PRIMARY KEY (room_id, seat)
    )
  `);

  // 创建 games 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      status TEXT NOT NULL,
      team_a_level TEXT NOT NULL DEFAULT '2',
      team_b_level TEXT NOT NULL DEFAULT '2',
      winner TEXT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER
    )
  `);

  // 创建 rounds 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      trump_rank TEXT NOT NULL,
      finish_order TEXT NOT NULL,
      level_change TEXT
    )
  `);

  // 创建 plays 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS plays (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL REFERENCES rounds(id),
      trick_number INTEGER NOT NULL,
      seat INTEGER NOT NULL,
      combo_type TEXT NOT NULL,
      cards TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);

  // 创建 leaderboard 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      agent_id TEXT PRIMARY KEY REFERENCES agents(id),
      games_played INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      rounds_played INTEGER NOT NULL DEFAULT 0,
      rounds_won INTEGER NOT NULL DEFAULT 0,
      win_rate REAL NOT NULL DEFAULT 0,
      elo_rating INTEGER NOT NULL DEFAULT 1000
    )
  `);

  // 常用查询索引
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
    CREATE INDEX IF NOT EXISTS idx_room_seats_agent_id ON room_seats(agent_id);
    CREATE INDEX IF NOT EXISTS idx_games_room_id ON games(room_id);
    CREATE INDEX IF NOT EXISTS idx_games_status_started_at ON games(status, started_at);
    CREATE INDEX IF NOT EXISTS idx_rounds_game_id ON rounds(game_id);
    CREATE INDEX IF NOT EXISTS idx_plays_round_id ON plays(round_id);
  `);

  console.log('[DB] Database initialized successfully');
}

// 导出 schema 供其他模块使用
export { schema };
