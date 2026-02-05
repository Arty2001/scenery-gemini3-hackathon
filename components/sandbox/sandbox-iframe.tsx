'use client';

/**
 * Sandbox iframe wrapper component
 *
 * Renders children in an isolated iframe using react-frame-component.
 * The iframe provides CSS isolation (no style leakage) and security isolation.
 *
 * Key features:
 * - Style reset prevents parent CSS from leaking in
 * - sandbox="allow-scripts" for security (NO allow-same-origin)
 * - Error boundary catches rendering errors
 */

import Frame from 'react-frame-component';
import React, { useCallback, useState } from 'react';

/**
 * Props for the SandboxIframe component
 */
export interface SandboxIframeProps {
  /** Content to render inside the isolated iframe */
  children: React.ReactNode;
  /** Optional CSS class for sizing the iframe */
  className?: string;
  /** Callback when iframe content is mounted and ready */
  onReady?: () => void;
  /** Callback when an error occurs in the iframe */
  onError?: (error: string) => void;
}

/**
 * Initial HTML content for the iframe with style reset
 */
const initialContent = `
<!DOCTYPE html>
<html>
  <head>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        background: white;
      }
      #mount { padding: 16px; }
    </style>
  </head>
  <body><div id="mount"></div></body>
</html>
`;

/**
 * Error boundary state interface
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary props
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: string) => void;
}

/**
 * Error boundary component for catching render errors in iframe content
 */
class SandboxErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[SandboxErrorBoundary] Error caught:', error, errorInfo);
    this.props.onError?.(error.message);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '16px',
            color: '#ef4444',
            backgroundColor: '#fef2f2',
            borderRadius: '4px',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
          }}
        >
          <strong>Render Error</strong>
          <p style={{ margin: '8px 0 0 0' }}>
            {this.state.error?.message || 'An unknown error occurred'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Sandbox iframe component for isolated component rendering
 *
 * Uses react-frame-component to render children in an isolated iframe
 * with a clean style reset and security sandbox attributes.
 *
 * @example
 * ```tsx
 * <SandboxIframe onReady={() => console.log('Ready!')}>
 *   <MyComponent {...props} />
 * </SandboxIframe>
 * ```
 */
export function SandboxIframe({
  children,
  className,
  onReady,
  onError,
}: SandboxIframeProps): React.ReactElement {
  const [isReady, setIsReady] = useState(false);

  const handleContentDidMount = useCallback(() => {
    setIsReady(true);
    onReady?.();
  }, [onReady]);

  return (
    <Frame
      initialContent={initialContent}
      mountTarget="#mount"
      contentDidMount={handleContentDidMount}
      className={className}
      sandbox="allow-scripts"
      style={{
        border: 'none',
        width: '100%',
        height: '100%',
      }}
    >
      <SandboxErrorBoundary onError={onError}>
        {isReady ? children : null}
      </SandboxErrorBoundary>
    </Frame>
  );
}

export default SandboxIframe;
