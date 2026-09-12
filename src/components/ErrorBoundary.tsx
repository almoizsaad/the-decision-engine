import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          className="flex flex-col items-center justify-center min-h-screen p-8"
          style={{ background: '#0D0F14' }}
          role="alert"
          aria-live="assertive"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-[#E15554]/10">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E15554" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold mb-4" style={{ fontFamily: 'Source Serif 4, serif', color: '#EDEEF2' }}>
            The engine hit an unrecoverable state
          </h1>
          <p className="mb-6 max-w-md text-center" style={{ color: '#8B92A3' }}>
            This is the UI failing, not a decision the engine made. Refresh to
            reset the session — nothing is persisted server-side.
          </p>
          {this.state.error && (
            <pre className="mb-6 p-4 rounded-lg text-xs overflow-auto max-w-lg w-full" style={{ background: '#181B22', color: '#8B92A3', border: '1px solid #262B36', fontFamily: 'IBM Plex Mono, monospace' }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReload}
            className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium bg-[#EDEEF2] text-[#0D0F14] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2FA8A0]"
            aria-label="Refresh page"
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
