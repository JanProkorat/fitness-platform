import { Component, type ReactNode } from 'react';

interface FallbackProps {
  error: Error | null;
}

/**
 * Shared fallback UI for both the app-root `ErrorBoundary` and the per-route
 * `RouteErrorBoundary` (#634) — kept as one component so the two boundaries
 * never drift visually.
 */
export function ErrorFallback({ error }: FallbackProps) {
  return (
    <div style={{ padding: 40, fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: '#c0392b' }}>
        Něco se pokazilo
      </h1>
      <p style={{ fontSize: 14, color: '#6b6860', marginBottom: 16 }}>
        Aplikace narazila na neočekávanou chybu.
      </p>
      <pre style={{
        fontSize: 12, padding: 16, background: '#f7f7f5', borderRadius: 6,
        border: '1px solid rgba(55,53,47,0.09)', overflow: 'auto', color: '#37352f',
      }}>
        {error?.message}
        {'\n'}
        {error?.stack}
      </pre>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 16, padding: '8px 16px', border: 'none', borderRadius: 6,
          background: '#37352f', color: '#fff', fontSize: 13, fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Obnovit stránku
      </button>
    </div>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Actionable logging surface (#634) — console.error only, no new logging dependency.
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
