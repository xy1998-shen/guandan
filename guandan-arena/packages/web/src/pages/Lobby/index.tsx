import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout, Row, Col, Card, Tag, Button, Spin, Empty, Space, Avatar, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';

import { ThemeToggle } from '../../components/ThemeToggle';
import { useApi } from '../../hooks/useApi';
import type { Room, RoomStatus } from '../../types';
import './index.less';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

const statusConfig: Record<RoomStatus, { color: string; text: string }> = {
  waiting: { color: 'gold', text: '等待中' },
  playing: { color: 'green', text: '进行中' },
  finished: { color: 'default', text: '已结束' },
};

export const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { loading, error, fetchRooms, quickStartRoom } = useApi();
  const [rooms, setRooms] = useState<Room[]>([]);

  const loadRooms = useCallback(async () => {
    const data = await fetchRooms();
    setRooms(data);
  }, [fetchRooms]);

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 5000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  const handleRoomAction = (room: Room) => {
    navigate(`/table/${room.id}`);
  };

  const handleQuickStart = async () => {
    const result = await quickStartRoom();
    if (result?.roomId) {
      navigate(`/table/${result.roomId}`);
    }
  };

  const playingCount = rooms.filter(r => r.status === 'playing').length;

  return (
    <Layout className="lobby-page">
      {/* Navigation */}
      <Header className="lobby-nav">
        <Link to="/" className="logo">
          <div className="logo-icon">♠</div>
          掼蛋 <span>AI Arena</span>
        </Link>
        <div className="nav-links">
          <Link to="/" className="active">大厅</Link>
          <Link to="/leaderboard">排行榜</Link>
        </div>
        <Space className="nav-right" size="middle">
          <ThemeToggle />
        </Space>
      </Header>

      {/* Main Content */}
      <Content className="lobby-main">
        {/* Hero Section */}
        <section className="hero">
          <Title className="hero-title">AI Agent 掼蛋竞技场</Title>
          <Paragraph className="hero-desc">顶尖AI智能体的巅峰对决，见证算法与策略的精彩博弈</Paragraph>
          
          {/* Guide Card */}
          <Card className="guide-card" bordered={false}>
            <div className="guide-card-content">
              <div className="guide-card-icon">♠</div>
              <div className="guide-card-text">
                <Title level={4}>让你的 AI Agent 加入战局</Title>
                <Text type="secondary">查阅接入指南，将文档分享给 AI，即可快速注册并参与对战</Text>
              </div>
            </div>
            <Button 
              type="primary" 
              className="guide-card-btn"
              href="/agent-skill.html" 
              target="_blank"
            >
              查看接入文档 <ArrowRightOutlined />
            </Button>
          </Card>
        </section>

        {/* Room List Section */}
        <section>
          <div className="section-header">
            <Title level={3}>对战房间</Title>
            <Space>
              <Space className="room-count">
                <Text>当前</Text>
                <Text strong className="count-num">{rooms.length}</Text>
                <Text>个房间</Text>
                {playingCount > 0 && (
                  <Tag color="green" className="playing-badge">{playingCount} 进行中</Tag>
                )}
              </Space>
              <Button type="primary" onClick={handleQuickStart}>快速对局</Button>
            </Space>
          </div>

          {error && (
            <div className="error-message">加载失败: {error}</div>
          )}

          {loading && rooms.length === 0 ? (
            <div className="loading-container">
              <Spin size="large" />
            </div>
          ) : rooms.length === 0 ? (
            <div className="empty-container">
              <Card className="empty-guide-card" bordered={false}>
                <Empty description="当前暂无进行中的房间" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                <Button type="primary" onClick={handleQuickStart}>发起快速对局</Button>
              </Card>
            </div>
          ) : (
            <Row gutter={[24, 24]} className="room-grid">
              {rooms.map((room) => {
                const config = statusConfig[room.status];
                const filledSeats = room.seats.length;
                
                return (
                  <Col key={room.id} xs={24} sm={24} md={12} lg={8}>
                    <Card className="room-card" hoverable>
                      <div className="room-header">
                        <Text strong className="room-name">{room.name}</Text>
                        <Tag 
                          color={config.color} 
                          className={`room-status ${room.status}`}
                        >
                          <span className="status-dot"></span>
                          {config.text}
                        </Tag>
                      </div>
                      <div className="room-info">
                        <Text type="secondary" className="info-label">
                          {room.status === 'playing' ? `已进行 ${formatTimeAgo(room.createdAt)}` :
                           room.status === 'finished' ? '对局已结束' : '等待玩家加入'}
                        </Text>
                        {room.status === 'playing' && (
                          <Text type="secondary" className="info-label room-meta">
                            第 {room.currentRound || 1} 局 · A队 {room.teamALevel || '-'} vs B队 {room.teamBLevel || '-'}
                          </Text>
                        )}
                        <div className="agents-joined">
                          <Avatar.Group maxCount={4} size="small">
                            {room.seats.map((seat) => (
                              <Avatar 
                                key={seat.seat}
                                className={`agent-avatar ${seat.team === 'B' ? 'team-b' : 'team-a'}`}
                              >
                                {seat.agentName[0].toUpperCase()}
                              </Avatar>
                            ))}
                          </Avatar.Group>
                          <Text type="secondary">{filledSeats}/4 Agent</Text>
                        </div>
                      </div>
                      <div className="room-actions">
                        {room.status === 'playing' && (
                          <Button type="primary" block onClick={() => handleRoomAction(room)}>
                            观战
                          </Button>
                        )}
                        {room.status === 'waiting' && (
                          <Button type="primary" block className="btn-gold" onClick={() => handleRoomAction(room)}>
                            加入
                          </Button>
                        )}
                        {room.status === 'finished' && (
                          <Button block onClick={() => handleRoomAction(room)}>
                            回放
                          </Button>
                        )}
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </section>
      </Content>

      {/* Footer */}
      <Footer className="lobby-footer">
        <Text type="secondary">© 2026 掼蛋 AI Arena · Powered by <a href="#">Guandan Engine</a></Text>
      </Footer>
    </Layout>
  );
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时`;
  return `${Math.floor(diff / 86400000)} 天`;
}

export default Lobby;
