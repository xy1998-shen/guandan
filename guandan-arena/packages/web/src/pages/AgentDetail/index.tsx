import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Empty, Layout, List, Progress, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useApi } from '../../hooks/useApi';
import type { AgentGameItem, AgentStatsResponse } from '../../types';
import './index.less';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export const AgentDetail: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const { loading, error, fetchAgentStats, fetchAgentGames } = useApi();
  const [stats, setStats] = useState<AgentStatsResponse | null>(null);
  const [games, setGames] = useState<AgentGameItem[]>([]);

  const load = useCallback(async () => {
    if (!agentId) return;
    const [statsData, gamesData] = await Promise.all([
      fetchAgentStats(agentId),
      fetchAgentGames(agentId),
    ]);
    setStats(statsData);
    setGames(gamesData);
  }, [agentId, fetchAgentStats, fetchAgentGames]);

  useEffect(() => {
    load();
  }, [load]);

  const trendPath = useMemo(() => {
    if (!stats || stats.eloTrend.length < 2) return '';
    const points = stats.eloTrend;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const height = 120;
    const width = 360;
    const scaleY = (value: number) => {
      if (max === min) return height / 2;
      return height - ((value - min) / (max - min)) * height;
    };
    return points
      .map((value, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = scaleY(value);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [stats]);

  const columns: ColumnsType<AgentGameItem> = [
    {
      title: '结果',
      key: 'result',
      width: 90,
      render: (_, row) => (
        <Tag color={row.result === 'win' ? 'green' : 'red'}>
          {row.result === 'win' ? '胜' : '负'}
        </Tag>
      ),
    },
    {
      title: '胜方',
      dataIndex: 'winner',
      key: 'winner',
      width: 100,
      render: (winner: string | null) => `Team ${winner || '-'}`,
    },
    {
      title: '最终级数',
      key: 'levels',
      render: (_, row) => `A:${row.teamALevel} / B:${row.teamBLevel}`,
    },
    {
      title: '参赛 Agent',
      key: 'players',
      render: (_, row) => (
        <Space size={[4, 8]} wrap>
          {row.players.map((p) => (
            <Tag key={`${row.gameId}-${p.agentId}`} className={p.team === 'A' ? 'team-a' : 'team-b'}>
              {p.agentName}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <Layout className="agent-detail-page">
      <Header className="agent-detail-nav">
        <Link to="/" className="logo">掼蛋 <span>AI Arena</span></Link>
        <Space>
          <Link to="/leaderboard">返回排行榜</Link>
          <ThemeToggle />
        </Space>
      </Header>
      <Content className="agent-detail-main">
        {error && <div className="error-message">加载失败: {error}</div>}
        {!agentId ? (
          <Empty description="缺少 Agent ID" />
        ) : (
          <>
            <Card className="agent-summary-card" bordered={false}>
              <Title level={3}>{stats?.agentName || '加载中...'}</Title>
              <RowStats stats={stats} />
            </Card>

            <Card className="agent-trend-card" bordered={false}>
              <Title level={4}>ELO 趋势</Title>
              {stats && stats.eloTrend.length > 1 ? (
                <svg viewBox="0 0 360 120" className="trend-svg">
                  <path d={trendPath} fill="none" stroke="var(--gold)" strokeWidth="3" />
                </svg>
              ) : (
                <Text type="secondary">样本不足，暂无法绘制趋势</Text>
              )}
            </Card>

            <Card className="agent-opponent-card" bordered={false}>
              <Title level={4}>对手记录</Title>
              <List
                dataSource={stats?.opponents || []}
                locale={{ emptyText: '暂无对手数据' }}
                renderItem={(item) => (
                  <List.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Text>{item.opponent}</Text>
                      <Space>
                        <Text type="secondary">{item.wins}/{item.games}</Text>
                        <Progress percent={Math.round(item.winRate * 100)} size="small" style={{ width: 120 }} />
                      </Space>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>

            <Card className="agent-games-card" bordered={false}>
              <Title level={4}>历史战绩</Title>
              <Table<AgentGameItem>
                rowKey="gameId"
                dataSource={games}
                columns={columns}
                loading={loading && games.length === 0}
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </>
        )}
      </Content>
    </Layout>
  );
};

const RowStats: React.FC<{ stats: AgentStatsResponse | null }> = ({ stats }) => (
  <div className="row-stats">
    <Statistic title="ELO" value={stats?.eloScore || 0} />
    <Statistic title="对局" value={stats?.gamesPlayed || 0} />
    <Statistic title="胜率" value={Math.round((stats?.winRate || 0) * 100)} suffix="%" />
    <Statistic title="回合胜率" value={Math.round((stats?.roundWinRate || 0) * 100)} suffix="%" />
  </div>
);

export default AgentDetail;
