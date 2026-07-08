import { Component, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Route-scoped error boundary (#634).
 *
 * The portal uses a component router (`<BrowserRouter>` + `<Routes>`), which
 * has no `errorElement` support (that's a `createBrowserRouter` data-router
 * feature only) — so instead of route-level `errorElement`s, `AppShell`
 * wraps the routed `<Outlet />` in this boundary. A throw inside a lazy
 * route pane is contained here instead of unmounting the whole app shell
 * (sidebar/top nav stay mounted and usable).
 *
 * `AppShell` mounts this keyed on the current pathname so navigating away
 * from a broken pane remounts a fresh, non-errored instance rather than
 * staying stuck on the fallback forever.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('RouteErrorBoundary caught an error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
