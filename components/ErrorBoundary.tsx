
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-rose-50 rounded-[2.5rem] border-2 border-dashed border-rose-200 animate-fade-up">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 className="text-xl font-black text-rose-800 uppercase tracking-tighter mb-2">Ops! Algo deu errado.</h2>
          <p className="text-sm text-rose-600 mb-6 font-bold uppercase tracking-wider">{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="px-6 py-3 bg-rose-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
