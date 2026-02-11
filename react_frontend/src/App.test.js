import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Retro Chess and reset button', () => {
  render(<App />);
  expect(screen.getByText(/retro chess/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
});
