/**
 * HTML template for rendering React components in Playwright
 *
 * Includes:
 * - React 18 from CDN (React 19 doesn't have UMD builds)
 * - Tailwind CSS for styling
 * - Base styles for component rendering
 */

export function createHtmlTemplate(options: {
  bundledJs: string;
  componentName: string;
  props: Record<string, unknown>;
}): string {
  const { bundledJs, componentName, props } = options;

  // Serialize props safely for injection into script
  const propsJson = JSON.stringify(props);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Render</title>

  <!-- React 18 from CDN (React 19 doesn't have UMD builds) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            background: '#ffffff',
            foreground: '#0a0a0a',
            primary: { DEFAULT: '#171717', foreground: '#fafafa' },
            secondary: { DEFAULT: '#f5f5f5', foreground: '#171717' },
            muted: { DEFAULT: '#f5f5f5', foreground: '#737373' },
            accent: { DEFAULT: '#f5f5f5', foreground: '#171717' },
            destructive: { DEFAULT: '#ef4444', foreground: '#fafafa' },
            border: '#e5e5e5',
            input: '#e5e5e5',
            ring: '#171717',
          },
          borderRadius: {
            lg: '0.5rem',
            md: '0.375rem',
            sm: '0.25rem',
          },
        },
      },
    }
  </script>

  <style>
    /* Reset and base styles */
    *, *::before, *::after {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      color: #0a0a0a;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Make root container responsive */
    #root {
      width: 100%;
      max-width: 100%;
    }

    #root > * {
      width: 100%;
      max-width: 100%;
    }

    /* Ensure images and media are responsive */
    img, video, iframe, svg {
      max-width: 100%;
      height: auto;
    }

    /* Ensure SVG icons render properly */
    svg {
      display: inline-block;
      vertical-align: middle;
    }

    /* Focus styles for interactive elements */
    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible,
    a:focus-visible {
      outline: 2px solid #171717;
      outline-offset: 2px;
    }

    /* Basic form element styling */
    input, select, textarea {
      font-family: inherit;
      font-size: inherit;
      max-width: 100%;
    }

    /* Responsive tables */
    table {
      max-width: 100%;
      overflow-x: auto;
      display: block;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script>
    // Error handling
    window.onerror = function(msg, url, line, col, error) {
      window.__RENDER_ERROR__ = { message: msg, stack: error?.stack };
      return true;
    };

    window.onunhandledrejection = function(event) {
      window.__RENDER_ERROR__ = { message: event.reason?.message || String(event.reason), stack: event.reason?.stack };
    };
  </script>

  <!-- Bundled component code -->
  <script>
    try {
      ${bundledJs}
    } catch (bundleError) {
      console.error('Bundle execution error:', bundleError);
      window.__RENDER_ERROR__ = { message: 'Bundle execution failed: ' + bundleError.message, stack: bundleError.stack };
    }
  </script>

  <script>
    (function() {
      try {
        // Debug: log what we have
        console.log('__SCENERY_COMPONENT__:', typeof window.__SCENERY_COMPONENT__, window.__SCENERY_COMPONENT__);

        // Get the component from the bundle
        const Component = window.__SCENERY_COMPONENT__;

        if (!Component) {
          window.__RENDER_ERROR__ = { message: 'Component not found on window.__SCENERY_COMPONENT__. Check console for bundle errors.' };
          return;
        }

        // Parse props
        const props = ${propsJson};

        // Create React element and render
        const element = React.createElement(Component, props);
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(element);

        // Signal render complete after React finishes
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.__RENDER_COMPLETE__ = true;
          });
        });

      } catch (error) {
        window.__RENDER_ERROR__ = { message: error.message, stack: error.stack };
      }
    })();
  </script>
</body>
</html>`;
}
