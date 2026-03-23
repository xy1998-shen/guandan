import React from 'react';
import type { Card, Rank, Suit } from '../../types';
import { SUIT_SYMBOLS, isWildCard } from '../../types';

interface CardSpriteProps {
  card: Card;
  trumpRank?: Rank;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const sizeMap = {
  small: { width: 40, height: 56, fontSize: 12 },
  medium: { width: 60, height: 84, fontSize: 16 },
  large: { width: 80, height: 112, fontSize: 20 },
};

function getCardColor(suit: Suit): 'red' | 'black' | 'special' {
  if (suit === 'H' || suit === 'D') return 'red';
  if (suit === 'JOKER') return 'special';
  return 'black';
}

function getDisplayRank(rank: Rank): string {
  if (rank === 'SMALL') return '小';
  if (rank === 'BIG') return '大';
  return rank;
}

export const CardSprite: React.FC<CardSpriteProps> = ({
  card,
  trumpRank,
  size = 'medium',
  faceDown = false,
  style,
  className = '',
}) => {
  const { width, height, fontSize } = sizeMap[size];
  const isWild = trumpRank ? isWildCard(card, trumpRank) : false;
  const color = getCardColor(card.suit);
  const isJoker = card.suit === 'JOKER';

  const baseStyles: React.CSSProperties = {
    width,
    height,
    borderRadius: 6,
    border: isWild ? '2px solid #ffd700' : '1px solid #ccc',
    backgroundColor: faceDown ? '#1a5c2e' : '#fff',
    boxShadow: isWild 
      ? '0 0 8px rgba(255, 215, 0, 0.5), 1px 1px 3px rgba(0,0,0,0.15)' 
      : '1px 1px 3px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    fontWeight: 'bold',
    cursor: 'default',
    transition: 'transform 0.2s, box-shadow 0.2s',
    position: 'relative',
    userSelect: 'none',
    ...style,
  };

  if (faceDown) {
    return (
      <div 
        className={`card card-back ${className}`}
        style={{
          ...baseStyles,
          backgroundImage: 'repeating-linear-gradient(45deg, #145a2e 0px, #145a2e 2px, #1a6b38 2px, #1a6b38 4px)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{
          width: width - 8,
          height: height - 8,
          border: '2px solid #ffd700',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ color: '#ffd700', fontSize: fontSize + 4 }}>AI</span>
        </div>
      </div>
    );
  }

  const colorStyle = color === 'red' ? '#d32f2f' : color === 'black' ? '#1a1a1a' : undefined;
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const displayRank = getDisplayRank(card.rank);

  if (isJoker) {
    const isSmall = card.rank === 'SMALL';
    return (
      <div 
        className={`card card-joker ${className}`}
        style={{
          ...baseStyles,
          background: isSmall 
            ? 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)' 
            : 'linear-gradient(135deg, #d32f2f 0%, #ff6b6b 100%)',
          color: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: fontSize + 8 }}>★</span>
        <span style={{ fontSize: fontSize - 2, marginTop: 4 }}>
          {isSmall ? '小王' : '大王'}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`card ${color === 'red' ? 'red' : 'black'} ${isWild ? 'wild' : ''} ${className}`}
      style={baseStyles}
    >
      {/* 左上角 */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: colorStyle,
        fontSize: fontSize,
        lineHeight: 1,
      }}>
        <span>{displayRank}</span>
        <span style={{ fontSize: fontSize - 2 }}>{suitSymbol}</span>
      </div>

      {/* 中央大花色 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colorStyle,
        fontSize: fontSize + 12,
      }}>
        {suitSymbol}
      </div>

      {/* 右下角（倒置） */}
      <div style={{
        position: 'absolute',
        bottom: 4,
        right: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: colorStyle,
        fontSize: fontSize,
        lineHeight: 1,
        transform: 'rotate(180deg)',
      }}>
        <span>{displayRank}</span>
        <span style={{ fontSize: fontSize - 2 }}>{suitSymbol}</span>
      </div>

      {/* 万能牌标记 */}
      {isWild && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#ffd700',
          fontSize: fontSize - 4,
          fontWeight: 'normal',
          textShadow: '0 0 2px rgba(0,0,0,0.5)',
        }}>
          万能
        </div>
      )}
    </div>
  );
};

// CSS animation styles (to be included in index.css)
export const cardStyles = `
.card:hover {
  transform: translateY(-8px);
  z-index: 10;
}

.card.selected {
  transform: translateY(-16px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px) rotate(-1deg); }
  75% { transform: translateX(4px) rotate(1deg); }
}

.bomb-effect {
  animation: shake 0.3s ease-in-out 2;
}

@keyframes cardFlyIn {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.card-fly-in {
  animation: cardFlyIn 0.3s ease-out;
}
`;

export default CardSprite;
