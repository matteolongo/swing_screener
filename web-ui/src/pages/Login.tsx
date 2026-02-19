import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Button from '@/components/common/Button';
import { exchangeProviderToken, login } from '@/features/auth/api';
import { saveSession } from '@/lib/auth';
import { AUTH_MODE, MANAGED_PROVIDER_LABEL } from '@/lib/authMode';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [providerToken, setProviderToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isManagedMode = AUTH_MODE === 'managed';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = isManagedMode
        ? await exchangeProviderToken(providerToken.trim())
        : await login(email.trim(), password);
      saveSession(response.accessToken, response.user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Swing Screener</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {isManagedMode
            ? `Authenticate with ${MANAGED_PROVIDER_LABEL} and exchange your provider token.`
            : 'Sign in to access your workspace.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {isManagedMode ? (
            <div className="space-y-1">
              <label htmlFor="provider-token" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Provider token
              </label>
              <textarea
                id="provider-token"
                value={providerToken}
                onChange={(event) => setProviderToken(event.target.value)}
                rows={4}
                required
                className="w-full rounded-md border border-border bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="w-full rounded-md border border-border bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-border bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </>
          )}

          {errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : isManagedMode ? 'Exchange token' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
