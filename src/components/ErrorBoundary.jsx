import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full glass-panel-strong rounded-card p-6 border border-rose/30 shadow-glass space-y-3">
            <h2 className="text-base font-black text-ink dark:text-white">Something went wrong</h2>
            <p className="text-xs text-rose font-medium">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="mt-3 px-4 py-2.5 rounded-btn bg-gradient-to-r from-primary to-primary2 text-white text-xs font-bold active:scale-95 shadow-md shadow-primary/20 cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

