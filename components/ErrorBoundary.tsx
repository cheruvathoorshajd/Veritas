'use client'

import React from 'react'

interface State {
  error: Error | null
}

interface Props {
  children: React.ReactNode
}

/**
 * Global render-error catcher. Wraps the entire app so an unhandled
 * exception in any component shows the recovery UI instead of an
 * unstyled crash screen. The error is logged to the console so it
 * also surfaces in dev tools.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Routed via console.error so structured loggers / Sentry / Vercel
    // dashboards all pick it up. No raw stack to the user.
    console.error('[error-boundary]', error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div
        style={{
          background: 'var(--bg, #080808)',
          color: 'var(--text, #DEDAD2)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          fontFamily: 'var(--font-body, system-ui)',
        }}
      >
        <div style={{ maxWidth: 540, width: '100%' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono, ui-monospace)',
              fontSize: 12,
              letterSpacing: 3,
              color: 'var(--coral, #FF3D2E)',
              marginBottom: 18,
            }}
          >
            (ERROR · UI CRASH)
          </div>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 500,
              letterSpacing: '-1.5px',
              margin: '0 0 18px',
            }}
          >
            Something broke while rendering.
          </h1>
          <p
            style={{
              fontSize: 16,
              color: 'var(--text-muted, #777)',
              lineHeight: 1.6,
              marginBottom: 28,
            }}
          >
            The pipeline you started is unaffected — only the UI failed to
            render the result. Reloading or clicking <em>Try again</em> will
            re-mount the component tree without losing the session.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.reset}
              style={{
                padding: '12px 22px',
                background: 'transparent',
                border: '1px solid var(--text, #DEDAD2)',
                color: 'var(--text, #DEDAD2)',
                fontFamily: 'var(--font-mono, ui-monospace)',
                fontSize: 13,
                letterSpacing: 2,
                cursor: 'pointer',
              }}
            >
              TRY AGAIN
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 22px',
                background: 'transparent',
                border: '1px solid var(--text-muted, #777)',
                color: 'var(--text-muted, #777)',
                fontFamily: 'var(--font-mono, ui-monospace)',
                fontSize: 13,
                letterSpacing: 2,
                cursor: 'pointer',
              }}
            >
              FULL RELOAD
            </button>
          </div>
          {process.env.NODE_ENV !== 'production' && (
            <pre
              style={{
                marginTop: 28,
                padding: 14,
                border: '1px solid var(--border, #141414)',
                background: 'var(--surface, #0F0F0F)',
                fontSize: 12,
                fontFamily: 'var(--font-mono, ui-monospace)',
                color: 'var(--coral, #FF3D2E)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
              }}
            >
              {this.state.error.message}
            </pre>
          )}
        </div>
      </div>
    )
  }
}
