import React, { useState, useEffect } from 'react';
import { CardSprite } from './CardSprite';
import { ComboType, type Trick, type TrickPlay, type PlayerState, type Rank, type Seat, isBomb } from '../../types';
import { getComboDisplayName } from '../../utils/comboName';
import './PlayArea.css';

interface PlayAreaProps {
  currentTrick: Trick | null;
  players: PlayerState[];
  trumpRank: Rank;
  seatToPosition: Record<Seat, 'top' | 'bottom' | 'left' | 'right'>;
}

interface PlaySlotProps {
  play: TrickPlay | null;
  player: PlayerState | undefined;
  position: 'top' | 'bottom' | 'left' | 'right';
  trumpRank: Rank;
}

const PlaySlot: React.FC<PlaySlotProps> = ({ play, player, position, trumpRank }) => {
  const [animate, setAnimate] = useState(false);
  const [shakeEffect, setShakeEffect] = useState(false);

  useEffect(() => {
    if (play) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 300);

      if (isBomb(play.combo.type)) {
        setShakeEffect(true);
        const shakeTimer = setTimeout(() => setShakeEffect(false), 600);
        return () => {
          clearTimeout(timer);
          clearTimeout(shakeTimer);
        };
      }

      return () => clearTimeout(timer);
    }
  }, [play?.timestamp]);

  const isPass = play?.combo.type === ComboType.PASS;
  const isVertical = position === 'top' || position === 'bottom';

  return (
    <div className={`play-slot ${position} ${shakeEffect ? 'bomb-effect' : ''}`}>
      {/* Player Name Label */}
      {player && (
        <div className="played-label">{player.agentName}</div>
      )}

      {/* Played Cards */}
      {play ? (
        isPass ? (
          <div className={`pass-indicator ${animate ? 'card-fly-in' : ''}`}>过</div>
        ) : (
          <div className="played-content">
            <div className="combo-label">{getComboDisplayName(play.combo)}</div>
            <div className={`played-cards ${isVertical ? 'horizontal' : 'vertical'} ${animate ? 'card-fly-in' : ''}`}>
              {play.combo.cards.map((card, index) => (
                <div
                  key={`${card.suit}_${card.rank}_${card.deckIndex}_${index}`}
                  className="played-card"
                  style={{
                    marginLeft: isVertical && index > 0 ? -25 : 0,
                    marginTop: !isVertical && index > 0 ? -40 : 0,
                    zIndex: index,
                  }}
                >
                  <CardSprite
                    card={card}
                    trumpRank={trumpRank}
                    size="small"
                  />
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="waiting-slot">等待出牌</div>
      )}
    </div>
  );
};

export const PlayArea: React.FC<PlayAreaProps> = ({
  currentTrick,
  players,
  trumpRank,
  seatToPosition,
}) => {
  const getPlayForSeat = (seat: Seat): TrickPlay | null => {
    if (!currentTrick) return null;
    return currentTrick.plays.find(p => p.seat === seat) || null;
  };

  const getPlayerBySeat = (seat: Seat): PlayerState | undefined => {
    return players.find(p => p.seat === seat);
  };

  const getPlayerNameBySeat = (seat: Seat): string => {
    const player = getPlayerBySeat(seat);
    return player?.agentName || `座位${seat}`;
  };

  return (
    <div className="play-area">
      {/* Center Text */}
      <div className="center-text">掼蛋</div>

      {/* Four Position Play Slots */}
      {([0, 1, 2, 3] as Seat[]).map(seat => (
        <PlaySlot
          key={seat}
          play={getPlayForSeat(seat)}
          player={getPlayerBySeat(seat)}
          position={seatToPosition[seat]}
          trumpRank={trumpRank}
        />
      ))}

      {/* Current Trick Info */}
      {currentTrick && (
        <div className="trick-info">
          领牌: {getPlayerNameBySeat(currentTrick.leadSeat)} |
          当前: {getPlayerNameBySeat(currentTrick.currentSeat)} |
          连过: {currentTrick.passCount}
        </div>
      )}
    </div>
  );
};

export default PlayArea;
