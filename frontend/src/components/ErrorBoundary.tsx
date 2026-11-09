import { Component, type ErrorInfo, type ReactNode } from 'react';
import { MASCOT_SRC } from './brand';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Segawa TradeAI crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[100dvh] place-items-center px-4">
        <div className="card max-w-lg text-center">
          <img src={MASCOT_SRC} alt="" className="mx-auto h-24 w-24 rounded-2xl object-cover object-top ring-1 ring-primary/40" />
          <h1 className="mt-4 text-lg font-semibold">Something interrupted the session</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your saved trades are stored safely. Reload to continue — if the problem repeats, clear the browser cache for this site.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-bg p-3 text-left text-[11px] text-loss">{this.state.error.message}</pre>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}>Reload app</button>
            <button className="btn-secondary" onClick={() => { localStorage.removeItem('segawa.v1.session'); window.location.hash = '#/login'; window.location.reload(); }}>
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }
}
