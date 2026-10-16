import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home as HomeIcon } from 'lucide-react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Pathd ErrorBoundary:', error, errorInfo);
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '70vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              background: 'var(--bg-secondary, #111827)',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
              borderRadius: '16px',
              padding: '2.5rem 2rem',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.45)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <div>
              <h2
                style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #ffffff)',
                }}
              >
                Algo no salió como esperábamos
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary, #9ca3af)',
                  lineHeight: 1.5,
                }}
              >
                Ocurrió un error inesperado al renderizar esta sección. Puedes intentar recargarla o regresar al inicio.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '0.8rem',
                  color: '#f87171',
                  overflowX: 'auto',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Detalles técnicos del error (modo desarrollo)
                </summary>
                <pre style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                width: '100%',
                marginTop: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={this.handleReload}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.4rem',
                  fontSize: '0.9rem',
                }}
              >
                <RefreshCw size={16} />
                Recargar página
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1.4rem',
                  fontSize: '0.9rem',
                  background: 'var(--bg-tertiary, #1f2937)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px',
                  color: 'var(--text-primary, #ffffff)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                <HomeIcon size={16} />
                Ir al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
