/**
 * End-to-end-ish integration tests: they mount the real <App /> (router + providers)
 * so a broken route, a broken guard or a broken store write fails here, not just in
 * the page-level smoke tests.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AppProvider } from '../context/AppContext';
import { ToastProvider } from '../context/ToastContext';
import { DEFAULT_PREFERENCES, seedDemoData } from '../lib/db';
import { DEFAULT_RISK_SETTINGS } from '../lib/risk';
import { netPnl } from '../lib/calc';

const USER_ID = 'flow-user';
const USER = { id: USER_ID, email: 'flow@segawa.app', fullName: 'Flow Trader', passwordHash: 'x', createdAt: new Date().toISOString() };

function writeUser(state: 'empty' | 'seeded') {
  const seeded = state === 'seeded' ? seedDemoData(USER_ID) : null;
  localStorage.clear();
  localStorage.setItem('segawa.v1.session', USER_ID);
  localStorage.setItem('segawa.v1.users', JSON.stringify([USER]));
  localStorage.setItem(`segawa.v1.${USER_ID}.preferences`, JSON.stringify(DEFAULT_PREFERENCES));
  localStorage.setItem(`segawa.v1.${USER_ID}.risk_settings`, JSON.stringify(DEFAULT_RISK_SETTINGS));
  if (seeded) {
    localStorage.setItem(`segawa.v1.${USER_ID}.trades`, JSON.stringify(seeded.trades));
    localStorage.setItem(`segawa.v1.${USER_ID}.challenges`, JSON.stringify(seeded.challenges));
    localStorage.setItem(`segawa.v1.${USER_ID}.psychology`, JSON.stringify(seeded.psych));
    localStorage.setItem(`segawa.v1.${USER_ID}.strategies`, JSON.stringify(seeded.strategies));
  }
  return seeded;
}

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

async function findHeading(name: RegExp, timeout = 8000) {
  const found = await screen.findAllByRole('heading', { name }, { timeout });
  expect(found.length).toBeGreaterThan(0);
  return found[0];
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

/* ------------------------------------------------------------------ */
/* 1. every authenticated route resolves through the real router       */
/* ------------------------------------------------------------------ */
describe('app routing', () => {
  const routes: { path: string; heading: RegExp; name: string }[] = [
    { path: '/', name: 'dashboard', heading: /Welcome/ },
    { path: '/journal', name: 'journal', heading: /Trade Journal/i },
    { path: '/journal/new', name: 'add trade', heading: /Log a trade/i },
    { path: '/analytics', name: 'analytics', heading: /Analytics/i },
    { path: '/coach', name: 'coach', heading: /AI Trading Coach/i },
    { path: '/audit', name: 'monthly audit', heading: /Monthly Trading Intelligence/i },
    { path: '/risk', name: 'risk', heading: /Risk Management/i },
    { path: '/strategy', name: 'strategy', heading: /Strategy Analysis/i },
    { path: '/psychology', name: 'psychology', heading: /Trading Psychology/i },
    { path: '/challenge', name: 'challenge', heading: /Challenge Tracker/i },
    { path: '/reports', name: 'reports', heading: /^Reports/ },
    { path: '/notifications', name: 'notifications', heading: /Notifications/i },
    { path: '/profile', name: 'profile', heading: /Profile/i },
    { path: '/settings', name: 'settings', heading: /Settings/i },
    { path: '/ai-config', name: 'ai config', heading: /AI Configuration/i },
    { path: '/nope', name: 'not found', heading: /Page not found/i },
  ];

  it.each(routes)('$name route renders', async ({ path, heading }) => {
    writeUser('seeded');
    mount(path);
    await findHeading(heading);
  });

  it('trade detail and edit routes render the stored trade', async () => {
    const seeded = writeUser('seeded');
    const trade = seeded!.trades[0];
    mount(`/journal/${trade.id}`);
    await findHeading(new RegExp(trade.instrument, 'i'));

    cleanup();
    mount(`/journal/${trade.id}/edit`);
    await findHeading(/Edit trade/i);
  });

  it('guards protected routes and sends signed-out visitors to login', { timeout: 15000 }, async () => {
    localStorage.clear();
    mount('/analytics');
    await findHeading(/Welcome back/i, 12000);
  });

  it('public routes render without a session', async () => {
    localStorage.clear();
    mount('/welcome');
    await findHeading(/Journal every trade/i);

    cleanup();
    mount('/register');
    await findHeading(/Create your workspace/i);
  });
});

/* ------------------------------------------------------------------ */
/* 2. add a trade -> persisted -> visible in the journal               */
/* ------------------------------------------------------------------ */
describe('trade lifecycle', () => {
  it('saves a new trade to storage and shows it in the journal', async () => {
    writeUser('empty');
    mount('/journal/new');
    await findHeading(/Log a trade/i);

    const instrument = screen.getByLabelText(/^Instrument/i) as HTMLInputElement;
    fireEvent.change(instrument, { target: { value: 'XAUUSD' } });

    // a closed trade, so the exit price counts toward the P&L
    fireEvent.change(screen.getAllByLabelText(/^Status/i)[0], { target: { value: 'closed' } });
    fireEvent.change(screen.getByLabelText(/Entry price/i), { target: { value: '2400' } });
    fireEvent.change(screen.getByLabelText(/^Exit price/i), { target: { value: '2412' } });
    fireEvent.change(screen.getAllByLabelText(/Stop loss/i)[0], { target: { value: '2394' } });
    fireEvent.change(screen.getByLabelText(/Lot size/i), { target: { value: '0.5' } });

    const save = screen.getAllByRole('button', { name: /Save trade/i }).at(-1)!;
    fireEvent.click(save);

    // the save redirects to the trade's own detail page
    await findHeading(/XAUUSD/i);
    expect(screen.getAllByText(/XAUUSD/).length).toBeGreaterThan(0);

    // and the record is listed in the journal itself
    fireEvent.click(screen.getAllByRole('link', { name: /^Journal/ })[0]);
    await findHeading(/Trade Journal/i);
    await waitFor(() => expect(screen.getAllByText(/XAUUSD/).length).toBeGreaterThan(0));

    const stored = JSON.parse(localStorage.getItem(`segawa.v1.${USER_ID}.trades`) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ instrument: 'XAUUSD', entryPrice: 2400, exitPrice: 2412, stopLoss: 2394, lotSize: 0.5 });
    // P&L is derived, never stored: 12 USD points / 0.01 tick x 1 tick value x 0.5 lots = 600
    expect(Math.round(netPnl(stored[0]))).toBe(600);
  }, 20000);
});

/* ------------------------------------------------------------------ */
/* 3. account deletion wipes local data and returns to login           */
/* ------------------------------------------------------------------ */
describe('account deletion', () => {
  it('deletes the profile, clears stored data and lands on login', async () => {
    writeUser('seeded');
    mount('/profile');
    await findHeading(/Profile/i);

    fireEvent.click(screen.getByRole('button', { name: /Delete account/i }));
    await screen.findByText(/Delete your account\?/i);
    fireEvent.click(screen.getByRole('button', { name: /Delete everything/i }));

    await findHeading(/Welcome back/i, 12000);
    const users = JSON.parse(localStorage.getItem('segawa.v1.users') ?? '[]');
    expect(users).toHaveLength(0);
    expect(localStorage.getItem('segawa.v1.session')).toBeNull();
    expect(localStorage.getItem(`segawa.v1.${USER_ID}.trades`)).toBeNull();
  }, 20000);
});

/* ------------------------------------------------------------------ */
/* 4. CSV export produces a real file from real records                */
/* ------------------------------------------------------------------ */
describe('report export', () => {
  it('exports the filtered trades as CSV with a header and the recorded rows', async () => {
    const seeded = writeUser('seeded');
    const blobs: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true, writable: true,
      value: (b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:mock'; },
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: () => {} });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    mount('/reports');
    await findHeading(/^Reports/);
    fireEvent.click(screen.getAllByRole('button', { name: /^CSV$/i })[0]);

    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(click).toHaveBeenCalled();

    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]);
    });

    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    expect(lines[0]).toBe('id,instrument,market,direction,entryPrice,exitPrice,stopLoss,takeProfit,lotSize,contractSize,tickSize,tickValue,entryTime,exitTime,session,timeframe,strategy,setup,riskPercent,riskAmount,commission,swap,spread,fees,grossPnl,netPnl,rMultiple,plannedRR,holdingMinutes,status,emotions,notes');
    expect(lines.length - 1).toBeGreaterThan(0);
    expect(lines.length - 1).toBeLessThanOrEqual(seeded!.trades.length);
    expect(lines[1]).toContain(seeded!.trades[0].instrument);
  }, 20000);
});
