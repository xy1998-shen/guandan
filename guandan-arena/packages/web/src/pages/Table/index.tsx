import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout, Space, Tag, Card, List, Typography, Modal, Button, Progress } from 'antd';
import { ArrowLeftOutlined, WifiOutlined, DisconnectOutlined } from '@ant-design/icons';
import { ThemeToggle } from '../../components/ThemeToggle';
import { GameBoard } from '../../components/table/GameBoard';
import { useGameSocket } from '../../hooks/useGameSocket';
import { useApi } from '../../hooks/useApi';
import { getOwnerId } from '../../utils/ownerId';
import type { Room, Seat } from '../../types';
import './index.less';

const { Header } = Layout;
const { Text } = Typography;

export const Table: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { fetchRoom, fetchMyAgents } = useApi();
  const [room, setRoom] = useState<Room | null>(null);
  const [myAgentSeat, setMyAgentSeat] = useState<Seat | undefined>(undefined);
  const [showRoundSummary, setShowRoundSummary] = useState(false);

  const {
    connected,
    spectatorCount,
    gameState,
    logs,
    roundSummary,
    gameSummary,
    turnInfo,
  } = useGameSocket({
    roomId: roomId || '',
  });

  useEffect(() => {
    if (roomId) {
      fetchRoom(roomId).then(setRoom);
    }
  }, [roomId, fetchRoom]);

  useEffect(() => {
    if (!room) return;

    const resolveMySeat = async () => {
      const ownerId = getOwnerId();
      const myAgents = await fetchMyAgents(ownerId);
      const myAgentIdSet = new Set(myAgents.map((item) => item.id));
      const mySeat = room.seats.find((seat) => myAgentIdSet.has(seat.agentId));
      setMyAgentSeat(mySeat?.seat as Seat | undefined);
    };

    resolveMySeat();
  }, [room, fetchMyAgents]);

  useEffect(() => {
    if (!roundSummary) return;
    setShowRoundSummary(true);
    const timer = window.setTimeout(() => setShowRoundSummary(false), 4000);
    return () => window.clearTimeout(timer);
  }, [roundSummary]);

  if (!roomId) {
    return (
      <div className="table-page table-error">
        <span>房间 ID 无效</span>
      </div>
    );
  }

  const currentRound = gameState?.currentRound;
  const statusText = gameState?.status === 'playing' ? '进行中' :
                     gameState?.status === 'finished' ? '已结束' : '等待中';
  const statusColor = gameState?.status === 'playing' ? 'success' : 
                      gameState?.status === 'finished' ? 'default' : 'warning';

  return (
    <Layout className="table-page">
      {/* Top Navigation */}
      <Header className="top-nav">
        <Space className="nav-left" size="large">
          <Link to="/" className="back-btn">
            <ArrowLeftOutlined />
            <span>返回大厅</span>
          </Link>
          <Space className="room-info" size="middle">
            <Text strong className="room-name">{room?.name || '加载中...'}</Text>
            <Tag color={statusColor} className="room-status-tag">
              <span className="status-dot"></span>
              {statusText}
            </Tag>
          </Space>
        </Space>

        <Space className="nav-center">
          <div className="turn-box">
            <div>
              <Text type="secondary" className="trump-label">当前级牌</Text>
              <Tag color="gold" className="trump-card">{currentRound?.trumpRank || '-'}</Tag>
            </div>
            {turnInfo && (
              <div className="turn-progress-wrap">
                <Text type="secondary">出牌倒计时：{turnInfo.agentName}</Text>
                <Progress
                  percent={Math.round((turnInfo.remainingMs / turnInfo.timeoutMs) * 100)}
                  size="small"
                  showInfo={false}
                  strokeColor="#52c41a"
                />
              </div>
            )}
          </div>
        </Space>

        <div className="nav-right">
          <span className={`connection-status ${connected ? 'connected' : ''}`}>
            {connected ? <WifiOutlined /> : <DisconnectOutlined />}
            {connected ? '已连接' : '未连接'}
          </span>
          <span className="round-info">
            第 {currentRound?.roundNumber || '-'} 局
          </span>
          <ThemeToggle />
        </div>
      </Header>

      {/* Main Table Area */}
      <div className="table-container">
        {/* Floating Team Scores (Top Left) */}
        <div className="table-info-left">
          <Space className="team-scores" size="middle">
            <Card size="small" className="team-score team-a" bordered={false}>
              <div className="team-indicator team-a"></div>
              <div className="score-info">
                <Text type="secondary" className="team-name">Team A</Text>
                <Text strong className="level team-a-level">{gameState?.teamALevel || '2'}</Text>
              </div>
            </Card>
            <Card size="small" className="team-score team-b" bordered={false}>
              <div className="team-indicator team-b"></div>
              <div className="score-info">
                <Text type="secondary" className="team-name">Team B</Text>
                <Text strong className="level team-b-level">{gameState?.teamBLevel || '2'}</Text>
              </div>
            </Card>
          </Space>
        </div>

        {/* Floating Spectators (Top Right) */}
        <div className="table-info-right">
          <Card size="small" className="spectators" bordered={false}>
            <Text type="secondary" className="spectator-label">观战</Text>
            <Text strong className="count">{spectatorCount}</Text>
            <Text type="secondary">人</Text>
          </Card>
        </div>

        {/* Game Board */}
        <div className="poker-table-wrapper">
          <GameBoard roundState={currentRound || null} myAgentSeat={myAgentSeat} />
        </div>
      </div>

      {/* Bottom Info Bar - Game Log */}
      <Card className="bottom-bar" bordered={false}>
        <div className="game-log">
          <Text type="secondary" className="game-log-title">出牌记录</Text>
          <List
            className="log-entries"
            dataSource={[...logs].reverse()}
            locale={{ emptyText: <Text type="secondary" className="log-empty">暂无出牌记录</Text> }}
            renderItem={(log) => (
              <List.Item key={log.id} className={`log-entry ${log.type}`}>
                <span className="player">{log.actor || '-'}</span>
                <span className="action">{log.action || log.message}</span>
                {log.comboType && <Tag className="combo-tag">{log.comboType}</Tag>}
              </List.Item>
            )}
          />
        </div>
      </Card>

      <Modal
        open={showRoundSummary && !!roundSummary}
        footer={null}
        centered
        closable={false}
        width={420}
        className="round-summary-modal"
      >
        {roundSummary && (
          <div className="round-summary-content">
            <h3>本局结果</h3>
            <p>胜方：Team {roundSummary.winnerTeam}</p>
            <p>{roundSummary.message}</p>
            <p>头游座位：{roundSummary.topSeat ?? '-'}</p>
            <p>末游座位：{roundSummary.lastSeat ?? '-'}</p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!gameSummary}
        title="游戏结算"
        centered
        maskClosable={false}
        closable={false}
        footer={[
          <Button key="back" type="primary" onClick={() => navigate('/')}>
            返回大厅
          </Button>,
        ]}
      >
        {gameSummary && (
          <div className="game-summary-content">
            <p>获胜队伍：Team {gameSummary.winner}</p>
            <p>Team A 最终级数：{gameSummary.teamALevel}</p>
            <p>Team B 最终级数：{gameSummary.teamBLevel}</p>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default Table;
