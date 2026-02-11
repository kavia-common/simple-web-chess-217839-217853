import React, { useMemo, useState } from 'react';
import './App.css';
import Chessboard from './components/Chessboard';
import {
  createInitialGameState,
  getGameStatus,
  getLegalMovesFromSquare,
  getTurnLabel,
  makeMove
} from './utils/chess';

function colorLabel(color) {
  return color === 'w' ? 'White' : 'Black';
}

function isSameSquare(a, b) {
  if (!a || !b) return false;
  return a.r === b.r && a.c === b.c;
}

function isPromotionMove(move) {
  return move.kind === 'promotion' || move.kind === 'promotion_capture';
}

function pieceAt(board, sq) {
  return board[sq.r][sq.c];
}

// PUBLIC_INTERFACE
function App() {
  /** Root app for local two-player chess game with retro-themed UI. */
  const [game, setGame] = useState(() => createInitialGameState());
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [message, setMessage] = useState('');
  const [movesLog, setMovesLog] = useState([]);

  const status = getGameStatus(game);

  const legalTargets = useMemo(() => legalMoves.map((m) => m.to), [legalMoves]);

  function clearSelection() {
    setSelected(null);
    setLegalMoves([]);
  }

  function resetGame() {
    setGame(createInitialGameState());
    setMovesLog([]);
    setMessage('New game started.');
    clearSelection();
  }

  function playMove(move) {
    const res = makeMove(game, move);
    if (!res.ok) {
      setMessage(res.error || 'Could not make move.');
      return;
    }

    setGame(res.nextState);
    setMovesLog((prev) => [...prev, res.san || 'move']);
    setMessage(res.nextState.status.message);
    clearSelection();
  }

  // PUBLIC_INTERFACE
  function onSquareClick(square) {
    /**
     * Handles click-to-select and click-to-move interactions.
     * - Click your piece to select and show legal destinations.
     * - Click a highlighted target to move.
     * - Click elsewhere to change selection / clear.
     */
    if (status.kind === 'checkmate' || status.kind === 'stalemate') {
      setMessage('Game is over. Press Reset to start again.');
      return;
    }

    const clickedPiece = pieceAt(game.board, square);
    const clickedColor = clickedPiece ? clickedPiece[0] : null;

    // If we have a selection and user clicked a legal target -> move
    if (selected) {
      const candidateMoves = legalMoves.filter((m) => m.to.r === square.r && m.to.c === square.c);
      if (candidateMoves.length > 0) {
        // If multiple promotions are possible, default to Queen (retro-friendly simplicity)
        let move = candidateMoves[0];
        if (candidateMoves.some(isPromotionMove)) {
          move = candidateMoves.find((m) => isPromotionMove(m) && m.promoteTo === 'q') || candidateMoves[0];
        }
        playMove(move);
        return;
      }
    }

    // Selecting a piece of the side to move
    if (clickedPiece && clickedColor === game.turn) {
      // Toggle off if clicking same selected
      if (isSameSquare(selected, square)) {
        clearSelection();
        setMessage('');
        return;
      }
      setSelected(square);
      const legal = getLegalMovesFromSquare(game, square);
      setLegalMoves(legal);
      setMessage(legal.length === 0 ? 'No legal moves for that piece.' : '');
      return;
    }

    // Otherwise clear selection
    clearSelection();
  }

  const turnText = `${getTurnLabel(game.turn)} to move`;
  const badgeText =
    status.kind === 'checkmate'
      ? 'CHECKMATE'
      : status.kind === 'stalemate'
        ? 'STALEMATE'
        : status.kind === 'check'
          ? 'CHECK'
          : 'PLAYING';

  return (
    <div className="App">
      <div className="Shell">
        <header className="Header">
          <div className="Header__brand">
            <div className="Header__title">Retro Chess</div>
            <div className="Header__subtitle">Two players • Same device • No fluff</div>
          </div>

          <div className="Header__meta" role="status" aria-live="polite">
            <div className="Badge" data-kind={status.kind}>
              {badgeText}
            </div>
            <div className="Turn">
              <span className="Turn__label">Turn</span>
              <span className="Turn__value">{turnText}</span>
            </div>
          </div>
        </header>

        <main className="Main">
          <section className="BoardPane" aria-label="Game board">
            <Chessboard
              board={game.board}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={game.lastMove}
              onSquareClick={onSquareClick}
            />

            <div className="Controls">
              <button className="Btn Btn--primary" type="button" onClick={resetGame}>
                Reset
              </button>
              <div className="Hint">
                Click a <span className="Hint__accent">{colorLabel(game.turn)}</span> piece, then click a glowing target.
              </div>
            </div>

            <div className="StatusBar" role="status" aria-live="polite">
              <div className="StatusBar__label">Status</div>
              <div className="StatusBar__text">{message || status.message}</div>
            </div>
          </section>

          <aside className="SidePane" aria-label="Move list">
            <div className="Panel">
              <div className="Panel__title">Moves</div>
              <div className="MovesList" role="log" aria-label="Moves log">
                {movesLog.length === 0 ? (
                  <div className="MovesList__empty">No moves yet.</div>
                ) : (
                  movesLog.map((m, idx) => (
                    <div key={`${m}-${idx}`} className="MovesList__row">
                      <div className="MovesList__idx">{idx + 1}.</div>
                      <div className="MovesList__move">{m}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <footer className="Footer">
              <div className="Footer__text">Built with React • Retro UI • Local rules engine</div>
            </footer>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
