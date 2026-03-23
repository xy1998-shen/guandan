import React from 'react';
import { PlayerSeat } from './PlayerSeat';
import { PlayArea } from './PlayArea';
import type { RoundState, Seat } from '../../types';
import './GameBoard.css';

interface GameBoardProps {
  roundState: RoundState | null;
  myAgentSeat?: Seat;
}

export const GameBoard: React.FC<GameBoardProps> = ({ roundState, myAgentSeat }) => {
  if (!roundState) {
    return (
      <div className="game-board game-board-empty">
        <div className="table-surface"></div>
        <div className="waiting-message">等待游戏开始...</div>
      </div>
    );
  }

  const { players, currentTrick, trumpRank } = roundState;

  const getPlayer = (seat: Seat) => players.find(p => p.seat === seat);
  const isCurrentTurn = (seat: Seat) => currentTrick?.currentSeat === seat;
  const baseSeat = myAgentSeat ?? 0;
  const rotateSeat = (offset: number): Seat => ((baseSeat + offset) % 4) as Seat;

  const seatByPosition = {
    bottom: rotateSeat(0),
    left: rotateSeat(1),
    top: rotateSeat(2),
    right: rotateSeat(3),
  } as const;

  const seatToPosition = {
    [seatByPosition.bottom]: 'bottom',
    [seatByPosition.left]: 'left',
    [seatByPosition.top]: 'top',
    [seatByPosition.right]: 'right',
  } as Record<Seat, 'top' | 'bottom' | 'left' | 'right'>;

  const positionToPoint: Record<'top' | 'bottom' | 'left' | 'right', { x: number; y: number }> = {
    top: { x: 50, y: 10 },
    bottom: { x: 50, y: 90 },
    left: { x: 12, y: 50 },
    right: { x: 88, y: 50 },
  };

  const teamALinkStart = positionToPoint[seatToPosition[0]];
  const teamALinkEnd = positionToPoint[seatToPosition[2]];
  const teamBLinkStart = positionToPoint[seatToPosition[1]];
  const teamBLinkEnd = positionToPoint[seatToPosition[3]];

  return (
    <div className="game-board">
      {/* Elliptical Table Surface */}
      <div className="table-surface"></div>

      <svg className="team-links" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1={teamALinkStart.x}
          y1={teamALinkStart.y}
          x2={teamALinkEnd.x}
          y2={teamALinkEnd.y}
          className="team-link team-a"
        />
        <line
          x1={teamBLinkStart.x}
          y1={teamBLinkStart.y}
          x2={teamBLinkEnd.x}
          y2={teamBLinkEnd.y}
          className="team-link team-b"
        />
      </svg>

      {/* Player Seat - Top (Seat 2) */}
      <div className="player-position top">
        {getPlayer(seatByPosition.top) && (
          <PlayerSeat
            player={getPlayer(seatByPosition.top)!}
            position="top"
            isCurrentTurn={isCurrentTurn(seatByPosition.top)}
            trumpRank={trumpRank}
          />
        )}
      </div>

      {/* Player Seat - Left (Seat 1) */}
      <div className="player-position left">
        {getPlayer(seatByPosition.left) && (
          <PlayerSeat
            player={getPlayer(seatByPosition.left)!}
            position="left"
            isCurrentTurn={isCurrentTurn(seatByPosition.left)}
            trumpRank={trumpRank}
          />
        )}
      </div>

      {/* Center Play Area */}
      <div className="center-play-area">
        <PlayArea
          currentTrick={currentTrick}
          players={players}
          trumpRank={trumpRank}
          seatToPosition={seatToPosition}
        />
      </div>

      {/* Player Seat - Right (Seat 3) */}
      <div className="player-position right">
        {getPlayer(seatByPosition.right) && (
          <PlayerSeat
            player={getPlayer(seatByPosition.right)!}
            position="right"
            isCurrentTurn={isCurrentTurn(seatByPosition.right)}
            trumpRank={trumpRank}
          />
        )}
      </div>

      {/* Player Seat - Bottom (Seat 0) */}
      <div className="player-position bottom">
        {getPlayer(seatByPosition.bottom) && (
          <PlayerSeat
            player={getPlayer(seatByPosition.bottom)!}
            position="bottom"
            isCurrentTurn={isCurrentTurn(seatByPosition.bottom)}
            trumpRank={trumpRank}
          />
        )}
      </div>
    </div>
  );
};

export default GameBoard;
