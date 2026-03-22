import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset);
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 p-6 text-center">
          <p className="text-sm font-semibold text-rose-600">Something went wrong</p>
          <p className="text-xs text-gray-500 max-w-sm">{error.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
