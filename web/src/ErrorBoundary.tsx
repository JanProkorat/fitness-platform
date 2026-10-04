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
    <div className="p-10 font-sans">
      <h1 className="mb-2 text-xl font-semibold text-destructive">Něco se pokazilo</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Aplikace narazila na neočekávanou chybu.
      </p>
      <pre className="overflow-auto rounded-sm border border-border bg-muted p-4 text-xs text-ink">
        {error?.message}
        {'\n'}
        {error?.stack}
      </pre>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 cursor-pointer rounded-md border-none bg-pill px-4 py-2 text-sm font-medium text-paper"
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
