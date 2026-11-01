import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-3 text-xl font-semibold text-stone-900">That page isn&rsquo;t here</h1>
      <p className="mt-2 text-sm text-stone-600">The link may be old, or the feature hasn&rsquo;t shipped yet.</p>
      <Link to="/" className="mt-6 inline-block">
        <Button>Back to home</Button>
      </Link>
    </div>
  );
}
