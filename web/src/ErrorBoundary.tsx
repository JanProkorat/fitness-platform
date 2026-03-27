import { Component, type ReactNode } from 'react';

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

  render() {
    if (this.state.hasError) {
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
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack}
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

    return this.props.children;
  }
}
