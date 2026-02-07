/**
 * HTTP client for the Playwright rendering worker
 *
 * Handles communication with the separate Playwright worker service
 * that renders React components in a real browser environment.
 */

export interface PlaywrightRenderOptions {
  bundledJs: string;
  componentName: string;
  props: Record<string, unknown>;
  timeout?: number;
}

export interface PlaywrightRenderResult {
  success: boolean;
  html?: string;
  error?: string;
  renderTime?: number;
}

class PlaywrightClient {
  private baseUrl: string | null;
  private secret: string | null;

  constructor() {
    this.baseUrl = process.env.PLAYWRIGHT_WORKER_URL || null;
    this.secret = process.env.PLAYWRIGHT_WORKER_SECRET || null;
  }

  /**
   * Check if the Playwright worker is configured
   */
  isConfigured(): boolean {
    return this.baseUrl !== null;
  }

  /**
   * Check if the Playwright worker is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.baseUrl) return false;

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Render a component using the Playwright worker
   */
  async render(options: PlaywrightRenderOptions): Promise<PlaywrightRenderResult> {
    if (!this.baseUrl) {
      return {
        success: false,
        error: 'Playwright worker URL not configured',
      };
    }

    const { bundledJs, componentName, props, timeout = 15000 } = options;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.secret) {
        headers['Authorization'] = `Bearer ${this.secret}`;
      }

      const response = await fetch(`${this.baseUrl}/render`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bundledJs,
          componentName,
          props,
          timeout,
        }),
        signal: AbortSignal.timeout(timeout + 5000), // Add buffer for network latency
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Worker responded with ${response.status}: ${errorText}`,
        };
      }

      const result: PlaywrightRenderResult = await response.json();
      return result;

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Handle specific error types
      if (message.includes('AbortError') || message.includes('timeout')) {
        return {
          success: false,
          error: `Render timeout after ${timeout}ms`,
        };
      }

      if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
        return {
          success: false,
          error: 'Playwright worker unavailable',
        };
      }

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Render with retry on transient failures
   */
  async renderWithRetry(
    options: PlaywrightRenderOptions,
    maxRetries: number = 1
  ): Promise<PlaywrightRenderResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.render(options);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Only retry on transient errors
      const isTransient =
        result.error?.includes('timeout') ||
        result.error?.includes('unavailable') ||
        result.error?.includes('ECONNREFUSED');

      if (!isTransient) {
        return result;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries + 1} attempts: ${lastError}`,
    };
  }
}

// Singleton instance
export const playwrightClient = new PlaywrightClient();
