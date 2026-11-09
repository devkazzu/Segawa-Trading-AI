import { describe, expect, it, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import { ToastProvider } from '../context/ToastContext';
import { seedDemoData, DEFAULT_PREFERENCES, type Snapshot } from '../lib/db';
import { DEFAULT_RISK_SETTINGS } from '../lib/risk';
import type { Profile } from '../lib/types';

import Dashboard from '../pages/Dashboard';
import Journal from '../pages/Journal';
import TradeForm from '../pages/TradeForm';
import Analytics from '../pages/Analytics';
import Coach from '../pages/Coach';
import MonthlyAudit from '../pages/MonthlyAudit';
import Risk from '../pages/Risk';
import StrategyAnalysis from '../pages/StrategyAnalysis';
import Psychology from '../pages/Psychology';
import Challenge from '../pages/Challenge';
import Reports from '../pages/Reports';
import Notifications from '../pages/Notifications';
import ProfilePage from '../pages/Profile';
import Settings from '../pages/Settings';
import AiConfig from '../pages/AiConfig';
import Onboarding from '../pages/Onboarding';
import Register from '../pages/Register';
import NotFound from '../pages/NotFound';

const USER_ID = 'smoke-user';
const USER = { id: USER_ID, email: 'smoke@segawa.app', fullName: 'Smoke Trader' };

function seed() {
  const seeded = seedDemoData(USER_ID);
  localStorage.clear();
  localStorage.setItem('segawa.v1.session', USER_ID);
  localStorage.setItem('segawa.v1.users', JSON.stringify([{ ...USER, passwordHash: 'x', createdAt: new Date().toISOString() }]));
  localStorage.setItem(`segawa.v1.${USER_ID}.trades`, JSON.stringify(seeded.trades));
  localStorage.setItem(`segawa.v1.${USER_ID}.challenges`, JSON.stringify(seeded.challenges));
  localStorage.setItem(`segawa.v1.${USER_ID}.psychology`, JSON.stringify(seeded.psych));
  localStorage.setItem(`segawa.v1.${USER_ID}.strategies`, JSON.stringify(seeded.strategies));
  localStorage.setItem(`segawa.v1.${USER_ID}.risk_settings`, JSON.stringify(DEFAULT_RISK_SETTINGS));
  localStorage.setItem(`segawa.v1.${USER_ID}.preferences`, JSON.stringify(DEFAULT_PREFERENCES));
}

function wrap(node: ReactNode, path = '/') {
  return (
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AppProvider>{node}</AppProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

/** Renders a page only after the store has hydrated from local storage. */
async function renderPage(node: ReactNode, path = '/') {
  const utils = render(wrap(node, path));
  await waitFor(() => expect(document.body.textContent).not.toMatch(/Loading your journal/i));
  return utils;
}

const pages: { name: string; element: ReactNode; path?: string; expect: RegExp }[] = [
  { name: 'Dashboard', element: <Dashboard />, expect: /Welcome back/i },
  { name: 'Journal', element: <Journal />, path: '/journal', expect: /Trade Journal/i },
  { name: 'TradeForm (new)', element: <TradeForm />, path: '/journal/new', expect: /Log a trade/i },
  { name: 'Analytics', element: <Analytics />, path: '/analytics', expect: /Analytics/i },
  { name: 'Coach', element: <Coach />, path: '/coach', expect: /AI Trading Coach/i },
  { name: 'MonthlyAudit', element: <MonthlyAudit />, path: '/audit', expect: /Monthly Trading Intelligence/i },
  { name: 'Risk', element: <Risk />, path: '/risk', expect: /Risk Management/i },
  { name: 'StrategyAnalysis', element: <StrategyAnalysis />, path: '/strategy', expect: /Strategy Analysis/i },
  { name: 'Psychology', element: <Psychology />, path: '/psychology', expect: /Trading Psychology/i },
  { name: 'Challenge', element: <Challenge />, path: '/challenge', expect: /Challenge Tracker/i },
  { name: 'Reports', element: <Reports />, path: '/reports', expect: /^Reports/ },
  { name: 'Notifications', element: <Notifications />, path: '/notifications', expect: /Notifications/i },
  { name: 'Profile', element: <ProfilePage />, path: '/profile', expect: /Profile/i },
  { name: 'Settings', element: <Settings />, path: '/settings', expect: /Settings/i },
  { name: 'AiConfig', element: <AiConfig />, path: '/ai-config', expect: /AI Configuration/i },
  { name: 'Onboarding', element: <Onboarding />, path: '/welcome', expect: /Journal every trade/i },
  { name: 'Register', element: <Register />, path: '/register', expect: /Create your workspace/i },
  { name: 'NotFound', element: <NotFound />, path: '/nope', expect: /Page not found/i },
];

describe('every page mounts without runtime errors', () => {
  beforeEach(() => seed());

  for (const page of pages) {
    it(`${page.name} renders`, async () => {
      await renderPage(page.element, page.path);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(page.expect);
    });
  }
});

describe('empty-journal states are honest, not fabricated', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('segawa.v1.session', USER_ID);
    localStorage.setItem('segawa.v1.users', JSON.stringify([{ ...USER, passwordHash: 'x', createdAt: new Date().toISOString() }]));
  });

  it('dashboard shows an empty state instead of sample numbers', async () => {
    await renderPage(<Dashboard />);
    expect(screen.getByText(/No trades recorded yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$10,000\.00/)).toBeNull();
  });

  it('analytics explains that nothing can be analysed yet', async () => {
    await renderPage(<Analytics />, '/analytics');
    expect(screen.getByText(/Nothing to analyse yet/i)).toBeInTheDocument();
  });
});

/** Compile-time guard: the snapshot shape used by the store stays in sync. */
const _shape: Partial<Snapshot> = { profile: { id: USER_ID } as Profile };
void _shape;
