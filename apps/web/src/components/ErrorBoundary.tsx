'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-sm text-gray-500 mb-4">
            {this.state.error?.message ?? '알 수 없는 오류가 발생했습니다.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs px-4 py-2 rounded-full bg-gray-100 text-gray-600 active:bg-gray-200"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
