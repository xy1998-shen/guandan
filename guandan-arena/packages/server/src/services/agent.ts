import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agents, leaderboard } from '../db/schema.js';
import type { Agent } from '@guandan/shared';

/**
 * 生成 API Token
 * 格式: gd_ + 32位随机十六进制字符串
 */
function generateApiToken(): string {
  return 'gd_' + crypto.randomBytes(32).toString('hex');
}

/**
 * 注册新的 Agent
 * @param name Agent 名称
 * @param callbackUrl 回调 URL
 * @returns agentId 和 apiToken
 */
export async function registerAgent(
  name: string,
  callbackUrl: string,
  ownerId?: string
): Promise<{ agentId: string; apiToken: string }> {
  const agentId = crypto.randomUUID();
  const apiToken = generateApiToken();
  const createdAt = Date.now();

  // 插入 agents 表
  await db.insert(agents).values({
    id: agentId,
    name,
    callbackUrl,
    apiToken,
    ownerId: ownerId ?? null,
    createdAt,
    active: 1,
  });

  // 在 leaderboard 表创建初始记录
  await db.insert(leaderboard).values({
    agentId,
    gamesPlayed: 0,
    gamesWon: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    winRate: 0,
    eloRating: 1000,
  });

  return { agentId, apiToken };
}

/**
 * 根据 ID 获取 Agent
 * @param agentId Agent ID
 * @returns Agent 或 null
 */
export async function getAgent(agentId: string): Promise<Agent | null> {
  const result = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const agent = result[0];
  return {
    id: agent.id,
    name: agent.name,
    callbackUrl: agent.callbackUrl,
    apiToken: agent.apiToken,
    ownerId: agent.ownerId ?? undefined,
    createdAt: agent.createdAt,
    active: agent.active === 1,
  };
}

/**
 * 根据 API Token 获取 Agent
 * @param token API Token
 * @returns Agent 或 null
 */
export async function getAgentByToken(token: string): Promise<Agent | null> {
  const result = await db
    .select()
    .from(agents)
    .where(eq(agents.apiToken, token))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const agent = result[0];
  return {
    id: agent.id,
    name: agent.name,
    callbackUrl: agent.callbackUrl,
    apiToken: agent.apiToken,
    ownerId: agent.ownerId ?? undefined,
    createdAt: agent.createdAt,
    active: agent.active === 1,
  };
}

/**
 * 根据 ownerId 查询 Agent 列表
 */
export async function listAgentsByOwner(ownerId: string): Promise<Agent[]> {
  const result = await db
    .select()
    .from(agents)
    .where(and(eq(agents.ownerId, ownerId), eq(agents.active, 1)));

  return result.map((agent) => ({
    id: agent.id,
    name: agent.name,
    callbackUrl: agent.callbackUrl,
    apiToken: agent.apiToken,
    ownerId: agent.ownerId ?? undefined,
    createdAt: agent.createdAt,
    active: agent.active === 1,
  }));
}

/**
 * 获取所有活跃 Agent（用于快速开局随机分配）
 */
export async function listActiveAgents(): Promise<Agent[]> {
  const result = await db
    .select()
    .from(agents)
    .where(eq(agents.active, 1));

  return result.map((agent) => ({
    id: agent.id,
    name: agent.name,
    callbackUrl: agent.callbackUrl,
    apiToken: agent.apiToken,
    ownerId: agent.ownerId ?? undefined,
    createdAt: agent.createdAt,
    active: agent.active === 1,
  }));
}
