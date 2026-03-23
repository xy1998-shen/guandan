import React from 'react';
import { CardSprite } from './CardSprite';
import type { PlayerState, Rank } from '../../types';
import './PlayerSeat.css';

interface PlayerSeatProps {
  player: PlayerState;
  position: 'top' | 'bottom' | 'left' | 'right';
  isCurrentTurn: boolean;
  trumpRank: Rank;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  position,
  isCurrentTurn,
  trumpRank,
}) => {
  const isVertical = position === 'top' || position === 'bottom';

  // Calculate card spread offset
  const getCardOffset = (index: number, total: number) => {
    if (isVertical) {
      const cardWidth = 40;
      const overlap = Math.min(25, (300 - cardWidth) / Math.max(total - 1, 1));
      const totalWidth = cardWidth + (total - 1) * overlap;
      const startX = -totalWidth / 2 + cardWidth / 2;
      return { left: startX + index * overlap, top: 0 };
    } else {
      const cardHeight = 56;
      const overlap = Math.min(18, (200 - cardHeight) / Math.max(total - 1, 1));
      const totalHeight = cardHeight + (total - 1) * overlap;
      const startY = -totalHeight / 2 + cardHeight / 2;
      return { left: 0, top: startY + index * overlap };
    }
  };

  // Calculate card rotation for fan effect
  const getCardRotation = (index: number, total: number) => {
    if (!isVertical) return 0;
    const maxAngle = Math.min(30, total * 3);
    const angleStep = maxAngle / Math.max(total - 1, 1);
    return -maxAngle / 2 + index * angleStep;
  };

  return (
    <div className={`player-seat ${position} team-${player.team.toLowerCase()} ${isCurrentTurn ? 'active' : ''}`}>
      {/* Player Info */}
      <div className={`player-info ${position}`}>
        <div className="player-name-tag">
          <div className={`team-badge ${player.team === 'A' ? 'team-a' : 'team-b'}`}>
            {player.team}
          </div>
          <span className="player-name">{player.agentName}</span>
        </div>
        {player.finished ? (
          <span className="card-count finish-badge">
            {player.finishOrder === 1 ? '头游' : 
             player.finishOrder === 2 ? '二游' : 
             player.finishOrder === 3 ? '三游' : '末游'}
          </span>
        ) : (
          <span className="card-count">{player.handCount} 张</span>
        )}
      </div>

      {/* Hand Cards */}
      {player.hand.length > 0 && !player.finished && (
        <div className={`hand-cards ${position}`}>
          {player.hand.map((card, index) => {
            const offset = getCardOffset(index, player.hand.length);
            const rotation = getCardRotation(index, player.hand.length);
            return (
              <div
                key={`${card.suit}_${card.rank}_${card.deckIndex}`}
                className="card-wrapper"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${offset.left}px), calc(-50% + ${offset.top}px)) rotate(${rotation}deg)`,
                  zIndex: index,
                }}
              >
                <CardSprite
                  card={card}
                  trumpRank={trumpRank}
                  size="small"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {(player.hand.length === 0 || player.finished) && (
        <div className={`hand-cards-empty ${position}`}>
          {player.finished ? '' : '等待发牌...'}
        </div>
      )}
    </div>
  );
};

export default PlayerSeat;
