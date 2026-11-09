import { Link } from 'react-router-dom';
import { Mascot } from '../components/brand';

export default function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-4">
      <div className="card max-w-md text-center">
        <Mascot size="lg" className="mx-auto" />
        <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-1.5 text-sm text-ink-muted">This route does not exist. Hiro suggests going back to the dashboard.</p>
        <Link to="/" className="btn-primary mt-4 inline-flex">Back to dashboard</Link>
      </div>
    </div>
  );
}
