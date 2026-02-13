import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ThreadDetailErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env?.DEV) {
      console.error('[Desk] Thread detail render failure', error, info);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-[520px] border-l border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 h-full flex items-center justify-center text-center p-8">
          <div>
            <p className="text-sm font-semibold text-rose-500 uppercase tracking-[0.3em] mb-3">Thread panel crashed</p>
            <h2 className="text-xl font-bold text-desk-text-primary-light dark:text-desk-text-primary-dark mb-3">
              Something went wrong loading this thread
            </h2>
            <p className="text-sm text-desk-text-secondary-light dark:text-desk-text-secondary-dark mb-6">
              Try refreshing the page or jump back to Focus View while we recover.
            </p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-black text-white dark:bg-white dark:text-black"
            >
              Retry loading panel
            </button>
            {import.meta.env?.DEV && this.state.error?.stack && (
              <pre className="mt-6 text-left text-xs overflow-x-auto text-rose-500/80">
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
