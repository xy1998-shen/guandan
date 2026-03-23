import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, Col, Empty, Layout, List, Progress, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useApi } from '../../hooks/useApi';
import type { AgentGameItem, AgentStatsResponse, ComboTypeDistributionItem, TeammateStatsItem } from '../../types';
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

            {/* 新增：风险偏好评分 */}
            <Card className="agent-risk-card" bordered={false}>
              <Title level={4}>风险偏好评分</Title>
              <RiskScoreDisplay score={stats?.riskScore ?? 0} />
            </Card>

            {/* 新增：响应时间统计 */}
            <Card className="agent-response-card" bordered={false}>
              <Title level={4}>响应时间统计</Title>
              <ResponseTimeDisplay stats={stats?.responseTimeStats} />
            </Card>

            {/* 新增：炸弹统计卡片 */}
            <Card className="agent-bomb-card" bordered={false}>
              <Title level={4}>炸弹统计</Title>
              <BombStatsDisplay stats={stats?.bombStats} />
            </Card>

            {/* 新增：牌型偏好分布 */}
            <Card className="agent-combo-card" bordered={false}>
              <Title level={4}>牌型偏好分布</Title>
              <ComboDistributionTable data={stats?.comboTypeDistribution || []} />
            </Card>

            {/* 新增：队友配合胜率 */}
            <Card className="agent-teammate-card" bordered={false}>
              <Title level={4}>队友配合胜率</Title>
              <TeammateStatsTable data={stats?.teammateStats || []} />
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

/** 风险偏好评分展示 */
const RiskScoreDisplay: React.FC<{ score: number }> = ({ score }) => {
  let color: string;
  let label: string;
  let description: string;
  if (score < 30) {
    color = '#1890ff';
    label = '保守型';
    description = '倾向于稳健出牌，少用炸弹，风险控制良好';
  } else if (score < 60) {
    color = '#faad14';
    label = '均衡型';
    description = '攻守平衡，根据牌情灵活调整策略';
  } else {
    color = '#ff4d4f';
    label = '激进型';
    description = '偏爱激进出牌，频繁使用炸弹，高风险高收益';
  }
  return (
    <div className="risk-score-display">
      <Row gutter={24} align="middle">
        <Col span={8}>
          <div className="risk-score-value" style={{ textAlign: 'center' }}>
            <Progress
              type="circle"
              percent={score}
              strokeColor={color}
              format={(percent) => <span style={{ color, fontWeight: 700, fontSize: 24 }}>{percent}</span>}
              size={100}
            />
          </div>
        </Col>
        <Col span={16}>
          <Tag color={color} style={{ fontSize: 16, padding: '4px 12px', marginBottom: 8 }}>{label}</Tag>
          <Text type="secondary">{description}</Text>
        </Col>
      </Row>
    </div>
  );
};

/** 响应时间统计展示 */
const ResponseTimeDisplay: React.FC<{ stats?: { avgResponseTimeMs: number; minResponseTimeMs: number; maxResponseTimeMs: number; totalPlays: number } }> = ({ stats }) => {
  if (!stats) return <Text type="secondary">暂无数据</Text>;
  const formatTime = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
  return (
    <Row gutter={16}>
      <Col span={6}>
        <Statistic title="平均响应" value={formatTime(stats.avgResponseTimeMs)} />
      </Col>
      <Col span={6}>
        <Statistic title="最快" value={formatTime(stats.minResponseTimeMs)} valueStyle={{ color: '#52c41a' }} />
      </Col>
      <Col span={6}>
        <Statistic title="最慢" value={formatTime(stats.maxResponseTimeMs)} valueStyle={{ color: '#ff4d4f' }} />
      </Col>
      <Col span={6}>
        <Statistic title="出牌次数" value={stats.totalPlays} />
      </Col>
    </Row>
  );
};

/** 炸弹统计展示 */
const BombStatsDisplay: React.FC<{ stats?: { bombTotal: number; bombSuccess: number; bombSuccessRate: number } }> = ({ stats }) => {
  if (!stats) return <Text type="secondary">暂无数据</Text>;
  const percent = Math.round(stats.bombSuccessRate * 100);
  const color = percent >= 60 ? '#52c41a' : percent >= 40 ? '#faad14' : '#ff4d4f';
  return (
    <Row gutter={16}>
      <Col span={8}>
        <Statistic title="炸弹总数" value={stats.bombTotal} />
      </Col>
      <Col span={8}>
        <Statistic title="成功数" value={stats.bombSuccess} />
      </Col>
      <Col span={8}>
        <Statistic
          title="命中率"
          value={percent}
          suffix="%"
          valueStyle={{ color }}
        />
      </Col>
    </Row>
  );
};

/** 牌型偏好分布表格 */
const ComboDistributionTable: React.FC<{ data: ComboTypeDistributionItem[] }> = ({ data }) => {
  const sortedData = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);
  const columns: ColumnsType<ComboTypeDistributionItem> = [
    { title: '牌型', dataIndex: 'comboType', key: 'comboType', width: 150 },
    { title: '使用次数', dataIndex: 'count', key: 'count', width: 100, align: 'center', sorter: (a, b) => a.count - b.count },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (value: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress percent={Math.round(value * 100)} size="small" style={{ flex: 1, maxWidth: 120 }} showInfo={false} />
          <span style={{ minWidth: 40 }}>{Math.round(value * 100)}%</span>
        </div>
      ),
    },
  ];
  if (sortedData.length === 0) return <Text type="secondary">暂无数据</Text>;
  return <Table<ComboTypeDistributionItem> rowKey="comboType" dataSource={sortedData} columns={columns} pagination={false} size="small" />;
};

/** 队友配合统计表格 */
const TeammateStatsTable: React.FC<{ data: TeammateStatsItem[] }> = ({ data }) => {
  const columns: ColumnsType<TeammateStatsItem> = [
    { title: '队友', dataIndex: 'teammateName', key: 'teammateName' },
    { title: '配合场次', dataIndex: 'gamesPlayed', key: 'gamesPlayed', width: 100, align: 'center' },
    { title: '胜场', dataIndex: 'gamesWon', key: 'gamesWon', width: 80, align: 'center' },
    {
      title: '胜率',
      dataIndex: 'winRate',
      key: 'winRate',
      width: 160,
      render: (value: number) => {
        const percent = Math.round(value * 100);
        const color = percent >= 60 ? '#52c41a' : percent >= 40 ? '#faad14' : '#ff4d4f';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress percent={percent} size="small" style={{ flex: 1, maxWidth: 100 }} showInfo={false} strokeColor={color} />
            <span style={{ color, fontWeight: 500, minWidth: 40 }}>{percent}%</span>
          </div>
        );
      },
    },
  ];
  if (data.length === 0) return <Text type="secondary">暂无队友配合数据</Text>;
  return <Table<TeammateStatsItem> rowKey="teammate" dataSource={data} columns={columns} pagination={false} size="small" />;
};

export default AgentDetail;
