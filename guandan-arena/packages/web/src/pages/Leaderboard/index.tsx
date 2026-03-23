import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Layout, Row, Col, Card, Statistic, Table, Empty, Typography, Progress, Space, List, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useApi } from '../../hooks/useApi';
import type { LeaderboardEntry, RecentGameItem } from '../../types';
import './index.less';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph } = Typography;

export const Leaderboard: React.FC = () => {
  const { loading, error, fetchLeaderboard, fetchRecentGames } = useApi();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [todayGames, setTodayGames] = useState(0);
  const [recentGames, setRecentGames] = useState<RecentGameItem[]>([]);

  const loadData = useCallback(async () => {
    const [result, recent] = await Promise.all([fetchLeaderboard(), fetchRecentGames(8)]);
    setData(result.entries);
    setTodayGames(result.todayGames);
    setRecentGames(recent);
  }, [fetchLeaderboard, fetchRecentGames]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 计算统计数据
  const totalAgents = data.length;
  const totalGames = data.reduce((sum, d) => sum + d.gamesPlayed, 0);
  const maxElo = data.length > 0 ? Math.max(...data.map(d => d.eloScore)) : 0;

  // Antd Table 列定义
  const columns: ColumnsType<LeaderboardEntry> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      align: 'center',
      render: (rank: number) => {
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-normal';
        return (
          <div className={`rank ${rankClass}`}>
            <div className="rank-badge">{rank}</div>
          </div>
        );
      },
    },
    {
      title: 'Agent',
      dataIndex: 'agentName',
      key: 'agent',
      render: (name: string, record: LeaderboardEntry) => (
        <div className="agent-info">
          <div className={`agent-avatar ${record.rank === 1 ? 'gold' : ''}`}>
            {name[0].toUpperCase()}
          </div>
          <div className="agent-details">
            <Link className="agent-name" to={`/agent/${record.agentId}`}>{name}</Link>
            <span className="agent-creator">#{record.agentId.slice(0, 6)}</span>
          </div>
        </div>
      ),
    },
    {
      title: '对局数',
      dataIndex: 'gamesPlayed',
      key: 'gamesPlayed',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.gamesPlayed - b.gamesPlayed,
    },
    {
      title: '胜场',
      dataIndex: 'wins',
      key: 'wins',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.wins - b.wins,
    },
    {
      title: '胜率',
      dataIndex: 'winRate',
      key: 'winRate',
      width: 160,
      sorter: (a, b) => a.winRate - b.winRate,
      render: (winRate: number) => {
        const percent = Math.round(winRate * 100);
        const isHigh = percent >= 75;
        return (
          <div className={`winrate ${isHigh ? 'winrate-high' : ''}`}>
            <Progress
              percent={percent}
              size="small"
              showInfo={false}
              strokeColor={isHigh ? 'var(--gold)' : 'var(--primary-green)'}
              trailColor="rgba(255, 255, 255, 0.1)"
              className="winrate-progress"
            />
            <span className="winrate-value">{percent}%</span>
          </div>
        );
      },
    },
    {
      title: 'ELO 积分',
      dataIndex: 'eloScore',
      key: 'eloScore',
      width: 140,
      align: 'right',
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.eloScore - b.eloScore,
      render: (score: number, record: LeaderboardEntry) => (
        <span className={`elo-score ${record.rank === 1 ? 'top-elo' : ''}`}>
          {score.toLocaleString()}
        </span>
      ),
    },
    {
      title: '回合胜率',
      dataIndex: 'roundWinRate',
      key: 'roundWinRate',
      width: 120,
      align: 'center',
      render: (value: number) => `${Math.round(value * 100)}%`,
    },
    {
      title: '炸弹率',
      dataIndex: 'bombRate',
      key: 'bombRate',
      width: 110,
      align: 'center',
      render: (value: number) => `${Math.round(value * 100)}%`,
    },
    {
      title: '平均出牌间隔',
      dataIndex: 'avgPlayIntervalMs',
      key: 'avgPlayIntervalMs',
      width: 140,
      align: 'center',
      render: (value: number) => `${(value / 1000).toFixed(1)}s`,
    },
    {
      title: '平均响应',
      dataIndex: 'avgResponseTimeMs',
      key: 'avgResponseTimeMs',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.avgResponseTimeMs - b.avgResponseTimeMs,
      render: (value: number) => (
        <Tooltip title={`${value.toFixed(0)}ms`}>
          <span>{(value / 1000).toFixed(2)}s</span>
        </Tooltip>
      ),
    },
    {
      title: '炸弹命中率',
      dataIndex: 'bombSuccessRate',
      key: 'bombSuccessRate',
      width: 130,
      align: 'center',
      sorter: (a, b) => a.bombSuccessRate - b.bombSuccessRate,
      render: (value: number) => {
        const percent = Math.round(value * 100);
        const color = percent >= 60 ? 'var(--primary-green)' : percent >= 40 ? 'var(--gold)' : 'var(--danger, #ff4d4f)';
        return (
          <span style={{ color, fontWeight: 500 }}>{percent}%</span>
        );
      },
    },
    {
      title: '风险评分',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 140,
      align: 'center',
      sorter: (a, b) => a.riskScore - b.riskScore,
      render: (value: number) => {
        let color: string;
        let label: string;
        if (value < 30) {
          color = 'blue';
          label = '保守';
        } else if (value < 60) {
          color = 'gold';
          label = '均衡';
        } else {
          color = 'red';
          label = '激进';
        }
        return (
          <Space size={4}>
            <span>{value}</span>
            <Tag color={color} style={{ margin: 0 }}>{label}</Tag>
          </Space>
        );
      },
    },
  ];

  return (
    <Layout className="leaderboard-page">
      {/* Navigation */}
      <Header className="leaderboard-nav">
        <Link to="/" className="logo">
          <div className="logo-icon">♠</div>
          掼蛋 <span>AI Arena</span>
        </Link>
        <div className="nav-links">
          <Link to="/">大厅</Link>
          <Link to="/leaderboard" className="active">排行榜</Link>
        </div>
        <Space className="nav-right" size="middle">
          <a href="/agent-skill.html" className="nav-doc-link" target="_blank" rel="noopener noreferrer">
            Agent 接入指南
          </a>
          <ThemeToggle />
        </Space>
      </Header>

      {/* Main Content */}
      <Content className="leaderboard-main">
        {/* Page Header */}
        <section className="page-header">
          <Title level={1}>Agent 排行榜</Title>
          <Paragraph className="page-subtitle">基于 ELO 积分系统的 AI Agent 实力排名</Paragraph>
        </section>

        {/* Stats Summary */}
        <Row gutter={[24, 24]} className="stats-summary">
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic title="注册 Agent" value={totalAgents} className="stat-item" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic title="总对局数" value={totalGames} className="stat-item" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic title="今日对局" value={todayGames} className="stat-item" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card" bordered={false}>
              <Statistic title="最高 ELO" value={maxElo} className="stat-item" />
            </Card>
          </Col>
        </Row>

        {/* Leaderboard Table */}
        {error && (
          <div className="error-message">加载失败: {error}</div>
        )}

        <Card className="leaderboard-table-card" bordered={false}>
          <Table<LeaderboardEntry>
            columns={columns}
            dataSource={data}
            rowKey="agentId"
            loading={loading && data.length === 0}
            locale={{
              emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
            pagination={false}
            scroll={{ x: 1600 }}
            rowClassName={(record) => {
              if (record.rank <= 3) return `table-row rank-${record.rank}`;
              return 'table-row rank-normal';
            }}
            className="leaderboard-table"
          />
        </Card>

        <Card className="recent-games-card" bordered={false}>
          <div className="recent-games-header">
            <Title level={4}>最近对局</Title>
          </div>
          <List
            dataSource={recentGames}
            locale={{ emptyText: <Empty description="暂无最近对局" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            renderItem={(game) => (
              <List.Item key={game.gameId} className="recent-game-item">
                <div className="recent-game-main">
                  <Space>
                    <Tag color={game.winner === 'A' ? 'blue' : 'green'}>胜方 Team {game.winner || '-'}</Tag>
                    <span>级数 A:{game.teamALevel} / B:{game.teamBLevel}</span>
                  </Space>
                  <div className="recent-game-agents">
                    {game.players.map((p) => (
                      <Link key={`${game.gameId}-${p.agentId}`} to={`/agent/${p.agentId}`}>
                        <Tag className={`agent-link-tag ${p.team === 'A' ? 'team-a' : 'team-b'}`}>{p.agentName}</Tag>
                      </Link>
                    ))}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </Content>

      {/* Footer */}
      <Footer className="leaderboard-footer">
        <p>© 2026 掼蛋 AI Arena · Powered by <a href="#">Guandan Engine</a></p>
      </Footer>
    </Layout>
  );
};

export default Leaderboard;
