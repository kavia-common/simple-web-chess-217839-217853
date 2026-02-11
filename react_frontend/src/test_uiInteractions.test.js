import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

function squareLabel(alg, pieceCode) {
  // App's Chessboard aria-label format:
  // `Square ${file}${rank}${piece ? `, ${piece}` : ''}`
  return pieceCode ? `Square ${alg}, ${pieceCode}` : `Square ${alg}`;
}

describe('UI interactions: select, move, reset', () => {
  test('selecting a piece highlights legal target squares (pawn from e2 -> e3/e4)', () => {
    render(<App />);

    const e2 = screen.getByRole('gridcell', { name: squareLabel('e2', 'wp') });
    fireEvent.click(e2);

    // Legal targets should show as dots (aria-hidden), easiest assertion is by CSS class on squares.
    const e3 = screen.getByRole('gridcell', { name: squareLabel('e3') });
    const e4 = screen.getByRole('gridcell', { name: squareLabel('e4') });

    expect(e3.className).toMatch(/Square--target/);
    expect(e4.className).toMatch(/Square--target/);
  });

  test('clicking the same selected square toggles selection off', () => {
    render(<App />);

    const e2 = screen.getByRole('gridcell', { name: squareLabel('e2', 'wp') });

    fireEvent.click(e2);
    expect(e2.className).toMatch(/Square--selected/);

    fireEvent.click(e2);
    expect(e2.className).not.toMatch(/Square--selected/);

    const e3 = screen.getByRole('gridcell', { name: squareLabel('e3') });
    const e4 = screen.getByRole('gridcell', { name: squareLabel('e4') });
    expect(e3.className).not.toMatch(/Square--target/);
    expect(e4.className).not.toMatch(/Square--target/);
  });

  test('making a move updates the move log and changes the turn label', () => {
    render(<App />);

    // Initially white to move
    expect(screen.getByText(/white to move/i)).toBeInTheDocument();

    // Select pawn e2
    fireEvent.click(screen.getByRole('gridcell', { name: squareLabel('e2', 'wp') }));
    // Move to e4 (double)
    fireEvent.click(screen.getByRole('gridcell', { name: squareLabel('e4') }));

    // Turn should now be Black to move
    expect(screen.getByText(/black to move/i)).toBeInTheDocument();

    // Moves log should no longer be empty
    expect(screen.queryByText(/no moves yet\./i)).not.toBeInTheDocument();
    // Should contain e4 as SAN for pawn double (engine uses destination only for pawn non-capture)
    expect(screen.getByText(/^e4$/i)).toBeInTheDocument();
  });

  test('reset clears move log and shows "New game started."', () => {
    render(<App />);

    // Make a move first
    fireEvent.click(screen.getByRole('gridcell', { name: squareLabel('e2', 'wp') }));
    fireEvent.click(screen.getByRole('gridcell', { name: squareLabel('e4') }));
    expect(screen.queryByText(/no moves yet\./i)).not.toBeInTheDocument();

    // Reset
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(screen.getByText(/new game started\./i)).toBeInTheDocument();
    expect(screen.getByText(/no moves yet\./i)).toBeInTheDocument();
    expect(screen.getByText(/white to move/i)).toBeInTheDocument();

    // Pawn should be back on e2 (with piece in aria-label)
    expect(screen.getByRole('gridcell', { name: squareLabel('e2', 'wp') })).toBeInTheDocument();
  });
});
