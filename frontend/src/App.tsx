import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LoadingOrb } from './components/brand';
import { useApp } from './context/AppContext';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import ErrorBoundary from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Journal = lazy(() => import('./pages/Journal'));
const TradeForm = lazy(() => import('./pages/TradeForm'));
const TradeDetails = lazy(() => import('./pages/TradeDetails'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Coach = lazy(() => import('./pages/Coach'));
const MonthlyAudit = lazy(() => import('./pages/MonthlyAudit'));
const Risk = lazy(() => import('./pages/Risk'));
const StrategyAnalysis = lazy(() => import('./pages/StrategyAnalysis'));
const Psychology = lazy(() => import('./pages/Psychology'));
const Challenge = lazy(() => import('./pages/Challenge'));
const Reports = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const AiConfig = lazy(() => import('./pages/AiConfig'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function SplashGate({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1500);
    return () => clearTimeout(t);
  }, []);
  if (done) return <>{children}</>;
  return <Splash />;
}

export default function App() {
  const { ready } = useApp();

  if (!ready) return <Splash />;

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="grid min-h-[70dvh] place-items-center"><LoadingOrb /></div>}>
        <Routes>
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/login" element={<SplashGate><Login /></SplashGate>} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <Protected>
                <AppShell />
              </Protected>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/journal/new" element={<TradeForm />} />
            <Route path="/journal/:id" element={<TradeDetails />} />
            <Route path="/journal/:id/edit" element={<TradeForm />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/coach" element={<Coach />} />
            <Route path="/audit" element={<MonthlyAudit />} />
            <Route path="/risk" element={<Risk />} />
            <Route path="/strategy" element={<StrategyAnalysis />} />
            <Route path="/psychology" element={<Psychology />} />
            <Route path="/challenge" element={<Challenge />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ai-config" element={<AiConfig />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
