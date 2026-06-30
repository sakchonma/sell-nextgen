import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ui-error-boundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-200">
          <div className="font-semibold">หน้านี้เกิดข้อผิดพลาด</div>
          <div className="mt-1 text-xs text-rose-200/80">{this.state.message || 'ไม่สามารถแสดงผลหน้านี้ได้'}</div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-4 rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold hover:bg-rose-500/10"
          >
            ลองอีกครั้ง
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
