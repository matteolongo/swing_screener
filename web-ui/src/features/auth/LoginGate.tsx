import { LogIn } from 'lucide-react';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { useAuth } from './AuthProvider';

export function LoginGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') {
    return <main className="min-h-screen grid place-items-center bg-canvas text-sm text-muted">Loading...</main>;
  }
  if (status === 'anonymous') {
    return (
      <main className="min-h-screen grid place-items-center bg-canvas px-6">
        <section className="w-full max-w-sm border border-border bg-surface p-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Swing Screener</h1>
          <a
            href={apiUrl(API_ENDPOINTS.authLogin)}
            className="mt-6 inline-flex h-9 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-white"
          >
            <LogIn size={16} aria-hidden="true" />
            Sign in
          </a>
        </section>
      </main>
    );
  }
  return <>{children}</>;
}
