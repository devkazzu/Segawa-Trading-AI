import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import { ToastProvider } from '../context/ToastContext';
import Login from '../pages/Login';
import { Markdown } from '../components/Markdown';

function wrap(node: React.ReactNode) {
  return (
    <HashRouter>
      <ToastProvider>
        <AppProvider>{node}</AppProvider>
      </ToastProvider>
    </HashRouter>
  );
}

describe('auth screen', () => {
  beforeEach(() => localStorage.clear());

  it('renders sign-in, demo entry and the local-mode disclosure', async () => {
    render(wrap(<Login />));
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explore with demo data/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/local demo mode/i)).toBeInTheDocument());
  });

  it('links to registration', () => {
    render(wrap(<Login />));
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '#/register');
  });
});

describe('markdown renderer', () => {
  it('renders headings, bullets, bold text and tables', () => {
    const md = '### Snapshot\n- Net **$120.00**\n\n| A | B |\n|---|---|\n| 1 | 2 |';
    render(<Markdown text={md} />);
    expect(screen.getByRole('heading', { name: /snapshot/i })).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
