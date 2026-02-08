import { chromium, Browser, BrowserContext } from 'playwright';
import { createHtmlTemplate } from './html-template.js';

export interface RenderOptions {
  bundledJs: string;
  componentName: string;
  props: Record<string, unknown>;
  timeout?: number;
  wrapperName?: string; // Optional provider wrapper (e.g., 'ThemeProvider')
}

export interface RenderResult {
  success: boolean;
  html?: string;
  error?: string;
  renderTime?: number;
  consoleLog?: string; // Browser console output for debugging
}

// Singleton browser instance for connection reuse
let browser: Browser | null = null;
let browserContext: BrowserContext | null = null;

/**
 * Initialize the browser instance
 */
export async function initBrowser(): Promise<void> {
  if (browser) return;

  console.log('[renderer] Launching browser...');
  browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  browserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2, // Retina for crisp rendering
  });

  console.log('[renderer] Browser launched successfully');
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browserContext) {
    await browserContext.close();
    browserContext = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
  console.log('[renderer] Browser closed');
}

/**
 * Render a React component and extract its HTML
 */
export async function renderComponent(options: RenderOptions): Promise<RenderResult> {
  const { bundledJs, componentName, props, timeout = 15000, wrapperName } = options;
  const startTime = Date.now();

  if (!browserContext) {
    await initBrowser();
  }

  const page = await browserContext!.newPage();

  // Capture console logs for debugging
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    consoleLogs.push(`[pageerror] ${err.message}`);
  });

  try {
    // Generate the HTML template
    const html = createHtmlTemplate({
      bundledJs,
      componentName,
      props,
      wrapperName,
    });

    // Load the page with the component
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: timeout,
    });

    // Wait for render to complete or error
    const result = await Promise.race([
      page.waitForFunction(
        () => window.__RENDER_COMPLETE__ === true || window.__RENDER_ERROR__ !== undefined,
        { timeout: timeout }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Render timeout')), timeout)
      ),
    ]);

    // Check for errors
    const renderError = await page.evaluate(() => (window as any).__RENDER_ERROR__);
    const consoleLogStr = consoleLogs.join('; ');

    if (renderError) {
      return {
        success: false,
        error: `Render error: ${renderError.message}`,
        renderTime: Date.now() - startTime,
        consoleLog: consoleLogStr,
      };
    }

    // Wait a bit more for any async effects to settle
    await page.waitForTimeout(100);

    // Extract the rendered HTML
    const renderedHtml = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root ? root.innerHTML : null;
    });

    if (!renderedHtml || renderedHtml.trim() === '') {
      return {
        success: false,
        error: `Empty render result - component may return null without required props (e.g., open=true for modals)`,
        renderTime: Date.now() - startTime,
        consoleLog: consoleLogStr,
      };
    }

    return {
      success: true,
      html: renderedHtml,
      renderTime: Date.now() - startTime,
      consoleLog: consoleLogStr,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[renderer] Error rendering ${componentName}:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      renderTime: Date.now() - startTime,
    };

  } finally {
    await page.close();
  }
}

// Type augmentation for window
declare global {
  interface Window {
    __RENDER_COMPLETE__?: boolean;
    __RENDER_ERROR__?: { message: string; stack?: string };
    __SCENERY_COMPONENT__?: React.ComponentType<any>;
  }
}
