import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">404</p>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        The page you requested does not exist.
      </p>
      <Link
        to="/workspace"
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-4 font-medium transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        Go to Workspace
      </Link>
    </div>
  );
}
