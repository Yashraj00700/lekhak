/**
 * ErrorBoundary — catches any uncaught render exception and shows a
 * recovery screen instead of a blank white page.
 *
 * Without this, any render-time exception in React 18 silently unmounts the
 * entire tree, leaving the page blank.
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { crashed: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[Lekhak] ErrorBoundary caught:', error, info?.componentStack);
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    const msg = this.state.error?.message || '';

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-[var(--theme-bg)] text-center gap-4">
        <div className="text-5xl">🛠️</div>
        <h2 className="m-0 text-[1.4rem] text-[var(--theme-text)]">
          काहीतरी चुकले — Something went wrong
        </h2>
        {msg && (
          <p className="text-xs text-[var(--theme-text-soft)] m-0 max-w-xs">{msg}</p>
        )}
        <button
          onClick={() => { window.location.href = '/'; }}
          className="mt-2 px-7 py-3 rounded-[10px] bg-[var(--color-terracotta)] text-[var(--color-cream)] font-semibold text-base border-none cursor-pointer"
        >
          मुख्य पानावर परत जा · Go home
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-[10px] bg-transparent text-[var(--color-terracotta)] border border-[var(--color-terracotta)] text-sm cursor-pointer"
        >
          पुन्हा सुरू करा · Reload
        </button>
      </div>
    );
  }
}
