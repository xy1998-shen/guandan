import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Lobby } from './pages/Lobby';
import { Table } from './pages/Table';
import { Leaderboard } from './pages/Leaderboard';
import { AgentDetail } from './pages/AgentDetail';

// Ant Design 主题配置
const darkThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#0d4a2e',
    colorBgContainer: '#111916',
    colorBgElevated: '#162019',
    colorBgBase: '#0a0f0d',
    colorText: '#f0f4f2',
    colorTextSecondary: '#8a9a90',
    colorBorder: '#1e2b24',
    borderRadius: 8,
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Table: {
      headerBg: '#111916',
      rowHoverBg: '#162019',
    },
    Card: {
      headerBg: '#111916',
    },
    Button: {
      primaryShadow: '0 2px 8px rgba(13, 74, 46, 0.4)',
    },
  },
};

const lightThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#0d4a2e',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#f8faf9',
    colorBgBase: '#f5f7f6',
    colorText: '#1a2e1f',
    colorTextSecondary: '#5a6a60',
    colorBorder: '#d8e0dc',
    borderRadius: 8,
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Table: {
      headerBg: '#f8faf9',
      rowHoverBg: '#f8faf9',
    },
    Card: {
      headerBg: '#f8faf9',
    },
    Button: {
      primaryShadow: '0 2px 8px rgba(13, 74, 46, 0.2)',
    },
  },
};

const AppContent: React.FC = () => {
  const { theme: currentTheme } = useTheme();
  const themeConfig = currentTheme === 'dark' ? darkThemeConfig : lightThemeConfig;

  return (
    <ConfigProvider locale={zhCN} theme={themeConfig}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/table/:roomId" element={<Table />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/agent/:agentId" element={<AgentDetail />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
