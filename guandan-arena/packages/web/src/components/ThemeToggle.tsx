import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.less';

interface ThemeToggleProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', style }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      title={isDark ? '切换浅色模式' : '切换深色模式'}
      style={style}
      aria-label={isDark ? '切换浅色模式' : '切换深色模式'}
    >
      <span className={`theme-toggle-icon ${isDark ? 'moon' : 'sun'}`}></span>
    </button>
  );
};

export default ThemeToggle;
