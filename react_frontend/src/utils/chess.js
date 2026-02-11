/**
 * Minimal chess engine utilities for local two-player play.
 * Board is an 8x8 array. Each piece is encoded as:
 *  - color: 'w' or 'b'
 *  - type: 'p','r','n','b','q','k'
 * Example: 'wp' = white pawn, 'bk' = black king.
 */

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function getPieceColor(piece) {
  return piece ? piece[0] : null;
}

function getPieceType(piece) {
  return piece ? piece[1] : null;
}

function otherColor(color) {
  return color === 'w' ? 'b' : 'w';
}

function toAlgebraic(square) {
  const { r, c } = square;
  return `${FILES[c]}${8 - r}`;
}

function fromAlgebraic(s) {
  const file = s[0];
  const rank = Number(s[1]);
  const c = FILES.indexOf(file);
  const r = 8 - rank;
  return { r, c };
}

// PUBLIC_INTERFACE
export function createInitialGameState() {
  /** Create a new game state for a standard chess starting position. */
  const empty = Array.from({ length: 8 }, () => Array(8).fill(null));

  // Black pieces
  empty[0] = ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'];
  empty[1] = Array(8).fill('bp');

  // White pieces
  empty[6] = Array(8).fill('wp');
  empty[7] = ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr'];

  return {
    board: empty,
    turn: 'w',
    // Castling rights: K/Q for white, k/q for black
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    // En-passant target square in {r,c} or null (square behind a pawn that advanced two)
    enPassant: null,
    // Halfmove/fullmove are not required for rules here (no 50-move / repetition)
    lastMove: null,
    status: { kind: 'playing', message: 'Game start' }
  };
}

function getKingSquare(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === `${color}k`) return { r, c };
    }
  }
  return null;
}

function isSquareAttacked(board, target, byColor, enPassantSquare) {
  // Generate pseudo-attacks from byColor and see if any hit target.
  // enPassantSquare is not needed for attacks, kept for signature symmetry.
  void enPassantSquare;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || getPieceColor(piece) !== byColor) continue;
      const type = getPieceType(piece);
      const from = { r, c };

      if (type === 'p') {
        const dir = byColor === 'w' ? -1 : 1;
        const attacks = [
          { r: r + dir, c: c - 1 },
          { r: r + dir, c: c + 1 }
        ];
        for (const sq of attacks) {
          if (inBounds(sq.r, sq.c) && sq.r === target.r && sq.c === target.c) return true;
        }
      } else if (type === 'n') {
        const deltas = [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1]
        ];
        for (const [dr, dc] of deltas) {
          const sq = { r: r + dr, c: c + dc };
          if (inBounds(sq.r, sq.c) && sq.r === target.r && sq.c === target.c) return true;
        }
      } else if (type === 'b' || type === 'r' || type === 'q') {
        const dirs = [];
        if (type === 'b' || type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        if (type === 'r' || type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

        for (const [dr, dc] of dirs) {
          let rr = r + dr;
          let cc = c + dc;
          while (inBounds(rr, cc)) {
            if (rr === target.r && cc === target.c) return true;
            if (board[rr][cc]) break;
            rr += dr;
            cc += dc;
          }
        }
      } else if (type === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const sq = { r: r + dr, c: c + dc };
            if (inBounds(sq.r, sq.c) && sq.r === target.r && sq.c === target.c) return true;
          }
        }
      } else {
        // ignore unknown
        void from;
      }
    }
  }

  return false;
}

function isInCheck(board, color, enPassant) {
  const kingSq = getKingSquare(board, color);
  if (!kingSq) return false;
  return isSquareAttacked(board, kingSq, otherColor(color), enPassant);
}

function addMove(moves, move) {
  moves.push(move);
}

function genSlidingMoves(board, from, color, dirs, moves) {
  for (const [dr, dc] of dirs) {
    let r = from.r + dr;
    let c = from.c + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) {
        addMove(moves, { from, to: { r, c }, kind: 'move' });
      } else {
        if (getPieceColor(target) !== color) {
          addMove(moves, { from, to: { r, c }, kind: 'capture' });
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
}

function genPseudoMovesForPiece(state, from) {
  const { board, turn: color, castling, enPassant } = state;
  const piece = board[from.r][from.c];
  if (!piece) return [];
  if (getPieceColor(piece) !== color) return [];

  const type = getPieceType(piece);
  const moves = [];

  if (type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    const startRank = color === 'w' ? 6 : 1;
    const promotionRank = color === 'w' ? 0 : 7;

    // Forward 1
    const f1 = { r: from.r + dir, c: from.c };
    if (inBounds(f1.r, f1.c) && !board[f1.r][f1.c]) {
      if (f1.r === promotionRank) {
        for (const promo of ['q', 'r', 'b', 'n']) {
          addMove(moves, { from, to: f1, kind: 'promotion', promoteTo: promo });
        }
      } else {
        addMove(moves, { from, to: f1, kind: 'move' });
      }

      // Forward 2
      const f2 = { r: from.r + 2 * dir, c: from.c };
      if (from.r === startRank && !board[f2.r][f2.c]) {
        addMove(moves, { from, to: f2, kind: 'double', setsEnPassant: { r: from.r + dir, c: from.c } });
      }
    }

    // Captures
    for (const dc of [-1, 1]) {
      const cap = { r: from.r + dir, c: from.c + dc };
      if (!inBounds(cap.r, cap.c)) continue;
      const target = board[cap.r][cap.c];
      if (target && getPieceColor(target) !== color) {
        if (cap.r === promotionRank) {
          for (const promo of ['q', 'r', 'b', 'n']) {
            addMove(moves, { from, to: cap, kind: 'promotion_capture', promoteTo: promo });
          }
        } else {
          addMove(moves, { from, to: cap, kind: 'capture' });
        }
      }
      // En passant capture
      if (!target && enPassant && cap.r === enPassant.r && cap.c === enPassant.c) {
        addMove(moves, { from, to: cap, kind: 'enpassant' });
      }
    }
  } else if (type === 'n') {
    const deltas = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1]
    ];
    for (const [dr, dc] of deltas) {
      const to = { r: from.r + dr, c: from.c + dc };
      if (!inBounds(to.r, to.c)) continue;
      const target = board[to.r][to.c];
      if (!target) addMove(moves, { from, to, kind: 'move' });
      else if (getPieceColor(target) !== color) addMove(moves, { from, to, kind: 'capture' });
    }
  } else if (type === 'b') {
    genSlidingMoves(board, from, color, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ], moves);
  } else if (type === 'r') {
    genSlidingMoves(board, from, color, [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ], moves);
  } else if (type === 'q') {
    genSlidingMoves(board, from, color, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ], moves);
  } else if (type === 'k') {
    // King steps
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const to = { r: from.r + dr, c: from.c + dc };
        if (!inBounds(to.r, to.c)) continue;
        const target = board[to.r][to.c];
        if (!target) addMove(moves, { from, to, kind: 'move' });
        else if (getPieceColor(target) !== color) addMove(moves, { from, to, kind: 'capture' });
      }
    }

    // Castling (basic legality: squares empty, not in check, and squares passed not attacked)
    const homeRank = color === 'w' ? 7 : 0;
    const kingHome = { r: homeRank, c: 4 };
    const kingAtHome = from.r === kingHome.r && from.c === kingHome.c;

    if (kingAtHome && !isInCheck(board, color, enPassant)) {
      // King side
      const canK = color === 'w' ? castling.wK : castling.bK;
      if (canK && !board[homeRank][5] && !board[homeRank][6]) {
        const pass1 = { r: homeRank, c: 5 };
        const pass2 = { r: homeRank, c: 6 };
        const attacked1 = isSquareAttacked(board, pass1, otherColor(color), enPassant);
        const attacked2 = isSquareAttacked(board, pass2, otherColor(color), enPassant);
        if (!attacked1 && !attacked2) {
          addMove(moves, { from, to: pass2, kind: 'castle_k' });
        }
      }
      // Queen side
      const canQ = color === 'w' ? castling.wQ : castling.bQ;
      if (canQ && !board[homeRank][3] && !board[homeRank][2] && !board[homeRank][1]) {
        const pass1 = { r: homeRank, c: 3 };
        const pass2 = { r: homeRank, c: 2 };
        const attacked1 = isSquareAttacked(board, pass1, otherColor(color), enPassant);
        const attacked2 = isSquareAttacked(board, pass2, otherColor(color), enPassant);
        if (!attacked1 && !attacked2) {
          addMove(moves, { from, to: pass2, kind: 'castle_q' });
        }
      }
    }
  }

  return moves;
}

function applyMove(state, move) {
  const { board, turn, castling } = state;
  const color = turn;
  const next = {
    board: cloneBoard(board),
    turn: otherColor(turn),
    castling: { ...castling },
    enPassant: null,
    lastMove: move,
    status: state.status
  };

  const piece = next.board[move.from.r][move.from.c];
  const pieceType = getPieceType(piece);

  // Clear source
  next.board[move.from.r][move.from.c] = null;

  // Special moves
  if (move.kind === 'enpassant') {
    next.board[move.to.r][move.to.c] = piece;
    // Captured pawn is behind target square
    const dir = color === 'w' ? 1 : -1;
    next.board[move.to.r + dir][move.to.c] = null;
  } else if (move.kind === 'promotion' || move.kind === 'promotion_capture') {
    next.board[move.to.r][move.to.c] = `${color}${move.promoteTo}`;
  } else if (move.kind === 'castle_k' || move.kind === 'castle_q') {
    const homeRank = color === 'w' ? 7 : 0;
    next.board[move.to.r][move.to.c] = piece;

    if (move.kind === 'castle_k') {
      // rook h-file to f-file
      next.board[homeRank][7] = null;
      next.board[homeRank][5] = `${color}r`;
    } else {
      // rook a-file to d-file
      next.board[homeRank][0] = null;
      next.board[homeRank][3] = `${color}r`;
    }
  } else {
    next.board[move.to.r][move.to.c] = piece;
  }

  // En-passant target
  if (move.kind === 'double' && move.setsEnPassant) {
    next.enPassant = move.setsEnPassant;
  }

  // Update castling rights if king/rook moved or rook captured
  if (pieceType === 'k') {
    if (color === 'w') {
      next.castling.wK = false;
      next.castling.wQ = false;
    } else {
      next.castling.bK = false;
      next.castling.bQ = false;
    }
  }
  if (pieceType === 'r') {
    if (color === 'w' && move.from.r === 7 && move.from.c === 0) next.castling.wQ = false;
    if (color === 'w' && move.from.r === 7 && move.from.c === 7) next.castling.wK = false;
    if (color === 'b' && move.from.r === 0 && move.from.c === 0) next.castling.bQ = false;
    if (color === 'b' && move.from.r === 0 && move.from.c === 7) next.castling.bK = false;
  }

  // If rook was captured on its home square, update rights too.
  const captured = board[move.to.r][move.to.c];
  if (captured && getPieceType(captured) === 'r') {
    const capColor = getPieceColor(captured);
    if (capColor === 'w' && move.to.r === 7 && move.to.c === 0) next.castling.wQ = false;
    if (capColor === 'w' && move.to.r === 7 && move.to.c === 7) next.castling.wK = false;
    if (capColor === 'b' && move.to.r === 0 && move.to.c === 0) next.castling.bQ = false;
    if (capColor === 'b' && move.to.r === 0 && move.to.c === 7) next.castling.bK = false;
  }

  return next;
}

function isLegalMove(state, move) {
  // Must be among pseudo moves for that piece with same destination & kind constraints.
  const pseudo = genPseudoMovesForPiece(state, move.from);
  const found = pseudo.find((m) => {
    if (m.to.r !== move.to.r || m.to.c !== move.to.c) return false;
    if (m.kind !== move.kind) return false;
    if ((m.kind === 'promotion' || m.kind === 'promotion_capture') && m.promoteTo !== move.promoteTo) return false;
    return true;
  });
  if (!found) return false;

  // Apply and ensure own king not in check
  const next = applyMove(state, found);
  return !isInCheck(next.board, state.turn, next.enPassant);
}

function getAllLegalMoves(state) {
  const moves = [];
  const { board, turn } = state;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || getPieceColor(piece) !== turn) continue;
      const pseudo = genPseudoMovesForPiece(state, { r, c });
      for (const m of pseudo) {
        const next = applyMove(state, m);
        if (!isInCheck(next.board, turn, next.enPassant)) moves.push(m);
      }
    }
  }
  return moves;
}

function computeStatus(state) {
  const { board, turn, enPassant } = state;
  const inCheck = isInCheck(board, turn, enPassant);
  const legal = getAllLegalMoves(state);
  if (legal.length === 0) {
    if (inCheck) {
      return {
        kind: 'checkmate',
        message: `${turn === 'w' ? 'White' : 'Black'} is checkmated. ${turn === 'w' ? 'Black' : 'White'} wins.`
      };
    }
    return { kind: 'stalemate', message: 'Stalemate. Draw.' };
  }
  if (inCheck) return { kind: 'check', message: `${turn === 'w' ? 'White' : 'Black'} is in check.` };
  return { kind: 'playing', message: `${turn === 'w' ? 'White' : 'Black'} to move.` };
}

// PUBLIC_INTERFACE
export function getLegalMovesFromSquare(state, from) {
  /** Returns all legal moves from a given square for the side to move. */
  const piece = state.board[from.r][from.c];
  if (!piece || getPieceColor(piece) !== state.turn) return [];
  const pseudo = genPseudoMovesForPiece(state, from);
  return pseudo.filter((m) => isLegalMove(state, m));
}

// PUBLIC_INTERFACE
export function makeMove(state, move) {
  /**
   * Attempt to make a move.
   * @returns { ok: boolean, nextState?: object, error?: string, san?: string }
   */
  if (state.status.kind === 'checkmate' || state.status.kind === 'stalemate') {
    return { ok: false, error: 'Game is over. Press Reset to start a new game.' };
  }

  if (!isLegalMove(state, move)) {
    return { ok: false, error: 'Illegal move.' };
  }

  const next = applyMove(state, move);
  const status = computeStatus(next);
  const san = formatMoveSAN(state, move, next, status);
  return { ok: true, nextState: { ...next, status }, san };
}

function formatMoveSAN(prevState, move, nextState, status) {
  // Lightweight SAN-ish notation for the move list UI.
  const piece = prevState.board[move.from.r][move.from.c];
  const type = getPieceType(piece);
  const isPawn = type === 'p';
  const dest = toAlgebraic(move.to);
  const capture = prevState.board[move.to.r][move.to.c] !== null || move.kind === 'enpassant' || move.kind === 'promotion_capture';
  const pieceLetter = isPawn
    ? ''
    : ({ n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' }[type] || '');

  if (move.kind === 'castle_k') return appendCheckMarks('O-O', status);
  if (move.kind === 'castle_q') return appendCheckMarks('O-O-O', status);

  let s = '';
  if (isPawn) {
    if (capture) s += `${FILES[move.from.c]}x${dest}`;
    else s += dest;
  } else {
    s += pieceLetter;
    if (capture) s += 'x';
    s += dest;
  }

  if (move.kind === 'promotion' || move.kind === 'promotion_capture') {
    const promoLetter = ({ q: 'Q', r: 'R', b: 'B', n: 'N' }[move.promoteTo] || 'Q');
    s += `=${promoLetter}`;
  }

  return appendCheckMarks(s, status);
}

function appendCheckMarks(notation, status) {
  if (status.kind === 'checkmate') return `${notation}#`;
  if (status.kind === 'check') return `${notation}+`;
  return notation;
}

// PUBLIC_INTERFACE
export function getGameStatus(state) {
  /** Returns current game status object {kind,message}. */
  return state.status;
}

// PUBLIC_INTERFACE
export function getTurnLabel(turn) {
  /** Returns user-friendly label for side to move. */
  return turn === 'w' ? 'White' : 'Black';
}
