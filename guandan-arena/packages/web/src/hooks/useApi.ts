import { useState, useCallback } from 'react';
import type {
  ApiResponse,
  Room,
  LeaderboardEntry,
  LeaderboardResponse,
  AgentStatsResponse,
  AgentGameItem,
  RecentGameItem,
} from '../types';

const API_BASE = '/api/v1';

interface UseApiOptions {
  onError?: (error: string) => void;
}

interface MyAgentItem {
  id: string;
  name: string;
  createdAt: number;
}

export function useApi(options?: UseApiOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: string) => {
    setError(err);
    options?.onError?.(err);
  }, [options]);

  const requestApi = useCallback(async <T,>(
    path: string,
    init?: RequestInit
  ): Promise<ApiResponse<T>> => {
    const response = await fetch(`${API_BASE}${path}`, init);
    const raw = await response.text();

    if (!raw || raw.trim() === '') {
      if (!response.ok) {
        throw new Error(`请求失败 (${response.status})`);
      }
      throw new Error('接口返回空响应');
    }

    let parsed: ApiResponse<T>;
    try {
      parsed = JSON.parse(raw) as ApiResponse<T>;
    } catch {
      if (!response.ok) {
        throw new Error(`请求失败 (${response.status})`);
      }
      throw new Error('接口返回非 JSON 数据');
    }

    if (!response.ok) {
      throw new Error(parsed.error || `请求失败 (${response.status})`);
    }

    return parsed;
  }, []);

  const fetchRooms = useCallback(async (): Promise<Room[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestApi<Room[]>('/rooms');
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch rooms');
      }
      return result.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      handleError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [handleError, requestApi]);

  const fetchRoom = useCallback(async (roomId: string): Promise<Room | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestApi<Room>(`/rooms/${roomId}`);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch room');
      }
      return result.data || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      handleError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleError, requestApi]);

  const fetchLeaderboard = useCallback(async (): Promise<LeaderboardResponse> => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestApi<LeaderboardEntry[] | LeaderboardResponse>('/leaderboard');
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch leaderboard');
      }

      const data = result.data;
      if (!data) {
        return { entries: [], todayGames: 0 };
      }

      // 兼容旧接口（直接返回数组）和新接口（包含 todayGames）
      if (Array.isArray(data)) {
        return { entries: data, todayGames: 0 };
      }

      return {
        entries: data.entries || [],
        todayGames: data.todayGames || 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      handleError(message);
      return { entries: [], todayGames: 0 };
    } finally {
      setLoading(false);
    }
  }, [handleError, requestApi]);

  const fetchMyAgents = useCallback(async (ownerId: string): Promise<MyAgentItem[]> => {
    setError(null);
    try {
      const result = await requestApi<MyAgentItem[]>(`/agents?ownerId=${encodeURIComponent(ownerId)}`);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch my agents');
      }
      return result.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      handleError(message);
      return [];
    }
  }, [handleError, requestApi]);

  const quickStartRoom = useCallback(async (): Promise<{ roomId: string; gameId: string } | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestApi<{ roomId: string; gameId: string }>('/rooms/quick-start', {
        method: 'POST',
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to quick start room');
      }
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      handleError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleError, requestApi]);

  const fetchAgentStats = useCallback(async (agentId: string): Promise<AgentStatsResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestApi<AgentStatsResponse>(`/agents/${agentId}/stats`);
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch agent stats');
      }
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      handleError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [handleError, requestApi]);

  const fetchAgentGames = useCallback(async (agentId: string): Promise<AgentGameItem[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestApi<AgentGameItem[]>(`/agents/${agentId}/games`);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch agent games');
      }
      return result.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      handleError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [handleError, requestApi]);

  const fetchRecentGames = useCallback(async (limit = 10): Promise<RecentGameItem[]> => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestApi<RecentGameItem[]>(`/games/recent?limit=${limit}`);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch recent games');
      }
      return result.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      handleError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [handleError, requestApi]);

  return {
    loading,
    error,
    fetchRooms,
    fetchRoom,
    fetchLeaderboard,
    fetchMyAgents,
    quickStartRoom,
    fetchAgentStats,
    fetchAgentGames,
    fetchRecentGames,
  };
}
