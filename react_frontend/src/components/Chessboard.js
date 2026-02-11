import React from 'react';
import './Chessboard.css';

const PIECE_GLYPHS = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚'
};

// PUBLIC_INTERFACE
export default function Chessboard({
  board,
  selected,
  legalTargets,
  lastMove,
  onSquareClick
}) {
  /** Renders the chessboard grid and forwards square click events. */

  function isSameSquare(a, b) {
    if (!a || !b) return false;
    return a.r === b.r && a.c === b.c;
  }

  function isLegalTarget(square) {
    return legalTargets?.some((t) => t.r === square.r && t.c === square.c);
  }

  function isLastMoveSquare(square) {
    if (!lastMove) return false;
    return isSameSquare(square, lastMove.from) || isSameSquare(square, lastMove.to);
  }

  return (
    <div className="Chessboard" role="grid" aria-label="Chessboard">
      {board.map((row, r) =>
        row.map((piece, c) => {
          const square = { r, c };
          const isLight = (r + c) % 2 === 0;
          const classes = [
            'Square',
            isLight ? 'Square--light' : 'Square--dark',
            isSameSquare(selected, square) ? 'Square--selected' : '',
            isLegalTarget(square) ? 'Square--target' : '',
            isLastMoveSquare(square) ? 'Square--lastmove' : ''
          ]
            .filter(Boolean)
            .join(' ');

          const glyph = piece ? PIECE_GLYPHS[piece] : '';

          return (
            <button
              key={`${r}-${c}`}
              className={classes}
              type="button"
              role="gridcell"
              onClick={() => onSquareClick(square)}
              aria-label={`Square ${String.fromCharCode(97 + c)}${8 - r}${piece ? `, ${piece}` : ''}`}
            >
              <span className="Square__piece" aria-hidden="true">
                {glyph}
              </span>
              {isLegalTarget(square) && <span className="Square__dot" aria-hidden="true" />}
            </button>
          );
        })
      )}
    </div>
  );
}
