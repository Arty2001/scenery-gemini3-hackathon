/**
 * HTML template for rendering React components in Playwright
 *
 * BULLETPROOF APPROACH:
 * - All browser APIs mocked upfront
 * - All context providers available
 * - Props wrapped with safe defaults
 * - Error boundaries for graceful fallback
 */

export function createHtmlTemplate(options: {
  bundledJs: string;
  componentName: string;
  props: Record<string, unknown>;
  wrapperName?: string;
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
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      color: #0a0a0a;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #root { width: 100%; max-width: 100%; }
    #root > * { width: 100%; max-width: 100%; }
    img, video, iframe, svg { max-width: 100%; height: auto; }
    svg { display: inline-block; vertical-align: middle; }
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, a:focus-visible {
      outline: 2px solid #171717;
      outline-offset: 2px;
    }
    input, select, textarea { font-family: inherit; font-size: inherit; max-width: 100%; }
    table { max-width: 100%; overflow-x: auto; display: block; }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="portal-root"></div>

  <script>
    // ============================================
    // BULLETPROOF ENVIRONMENT SETUP
    // All mocks and polyfills BEFORE any code runs
    // ============================================

    // Error capture
    window.__RENDER_ERRORS__ = [];
    window.onerror = function(msg, url, line, col, error) {
      window.__RENDER_ERRORS__.push({ message: String(msg), stack: error?.stack });
      window.__RENDER_ERROR__ = { message: String(msg), stack: error?.stack };
      return true;
    };
    window.onunhandledrejection = function(event) {
      const msg = event.reason?.message || String(event.reason);
      window.__RENDER_ERRORS__.push({ message: msg, stack: event.reason?.stack });
      window.__RENDER_ERROR__ = { message: msg, stack: event.reason?.stack };
    };

    // ========== BROWSER API MOCKS ==========

    // matchMedia
    window.matchMedia = window.matchMedia || function(query) {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: function() {},
        removeListener: function() {},
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      };
    };

    // Storage
    var mockStorage = {
      _data: {},
      getItem: function(k) { return this._data[k] || null; },
      setItem: function(k, v) { this._data[k] = String(v); },
      removeItem: function(k) { delete this._data[k]; },
      clear: function() { this._data = {}; },
      get length() { return Object.keys(this._data).length; },
      key: function(i) { return Object.keys(this._data)[i] || null; }
    };
    if (!window.localStorage) window.localStorage = mockStorage;
    if (!window.sessionStorage) window.sessionStorage = Object.assign({}, mockStorage, { _data: {} });

    // ResizeObserver
    if (!window.ResizeObserver) {
      window.ResizeObserver = function(cb) {
        this.observe = function() {};
        this.unobserve = function() {};
        this.disconnect = function() {};
      };
    }

    // IntersectionObserver
    if (!window.IntersectionObserver) {
      window.IntersectionObserver = function(cb) {
        this.observe = function() {};
        this.unobserve = function() {};
        this.disconnect = function() {};
        this.takeRecords = function() { return []; };
      };
    }

    // MutationObserver
    if (!window.MutationObserver) {
      window.MutationObserver = function(cb) {
        this.observe = function() {};
        this.disconnect = function() {};
        this.takeRecords = function() { return []; };
      };
    }

    // requestAnimationFrame/cancelAnimationFrame
    window.requestAnimationFrame = window.requestAnimationFrame || function(cb) { return setTimeout(cb, 16); };
    window.cancelAnimationFrame = window.cancelAnimationFrame || function(id) { clearTimeout(id); };

    // scrollTo
    window.scrollTo = window.scrollTo || function() {};
    if (!Element.prototype.scrollTo) Element.prototype.scrollTo = function() {};
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function() {};

    // getBoundingClientRect - ensure it always returns something
    var origGetBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      try {
        return origGetBCR.call(this);
      } catch (e) {
        return { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100, x: 0, y: 0 };
      }
    };

    // getComputedStyle - safe version
    var origGetCS = window.getComputedStyle;
    window.getComputedStyle = function(el, pseudo) {
      try {
        return origGetCS.call(window, el, pseudo);
      } catch (e) {
        return {};
      }
    };

    // Clipboard API
    if (!navigator.clipboard) {
      navigator.clipboard = {
        writeText: function() { return Promise.resolve(); },
        readText: function() { return Promise.resolve(''); }
      };
    }

    // Geolocation
    if (!navigator.geolocation) {
      navigator.geolocation = {
        getCurrentPosition: function(cb) { cb({ coords: { latitude: 0, longitude: 0, accuracy: 100 } }); },
        watchPosition: function() { return 0; },
        clearWatch: function() {}
      };
    }

    // fetch - ensure it exists
    window.fetch = window.fetch || function() {
      return Promise.resolve({ ok: true, json: function() { return Promise.resolve({}); } });
    };

    // Performance API
    if (!window.performance) window.performance = { now: function() { return Date.now(); } };
    if (!window.performance.mark) window.performance.mark = function() {};
    if (!window.performance.measure) window.performance.measure = function() {};

    // History API
    if (!window.history.pushState) window.history.pushState = function() {};
    if (!window.history.replaceState) window.history.replaceState = function() {};

    // Crypto API
    if (!window.crypto) {
      window.crypto = {
        getRandomValues: function(arr) {
          for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
          return arr;
        },
        randomUUID: function() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        }); }
      };
    }

    // Window dimensions
    if (!window.innerWidth) window.innerWidth = 1280;
    if (!window.innerHeight) window.innerHeight = 720;
    if (!window.outerWidth) window.outerWidth = 1280;
    if (!window.outerHeight) window.outerHeight = 720;
    if (!window.screen) window.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 };
    if (!window.devicePixelRatio) window.devicePixelRatio = 2;

    // Navigator enhancements
    if (!navigator.userAgent) navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
    if (!navigator.language) navigator.language = 'en-US';
    if (!navigator.languages) navigator.languages = ['en-US', 'en'];
    if (!navigator.onLine) navigator.onLine = true;
    if (!navigator.cookieEnabled) navigator.cookieEnabled = true;
    if (!navigator.mediaDevices) navigator.mediaDevices = { getUserMedia: function() { return Promise.reject(new Error('Not supported')); } };

    // XMLHttpRequest mock
    if (!window.XMLHttpRequest) {
      window.XMLHttpRequest = function() {
        return {
          open: function() {},
          send: function() { this.readyState = 4; this.status = 200; this.responseText = '{}'; if (this.onload) this.onload(); },
          setRequestHeader: function() {},
          getResponseHeader: function() { return ''; },
          abort: function() {},
          readyState: 0,
          status: 0,
          responseText: ''
        };
      };
    }

    // FileReader mock
    if (!window.FileReader) {
      window.FileReader = function() {
        return {
          readAsDataURL: function() { this.result = 'data:;base64,'; if (this.onload) this.onload(); },
          readAsText: function() { this.result = ''; if (this.onload) this.onload(); },
          readAsArrayBuffer: function() { this.result = new ArrayBuffer(0); if (this.onload) this.onload(); },
          result: null
        };
      };
    }

    // Blob/File - ensure URL methods exist
    if (!window.URL.createObjectURL) window.URL.createObjectURL = function() { return 'blob:mock'; };
    if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = function() {};

    // Canvas mock (for html2canvas, charts, etc.)
    var origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag) {
      var el = origCreateElement(tag);
      if (tag.toLowerCase() === 'canvas') {
        el.getContext = function(type) {
          return {
            canvas: el,
            fillRect: function() {},
            clearRect: function() {},
            getImageData: function(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
            putImageData: function() {},
            createImageData: function() { return { data: [] }; },
            setTransform: function() {},
            drawImage: function() {},
            save: function() {},
            restore: function() {},
            beginPath: function() {},
            moveTo: function() {},
            lineTo: function() {},
            closePath: function() {},
            stroke: function() {},
            fill: function() {},
            arc: function() {},
            rect: function() {},
            measureText: function() { return { width: 0 }; },
            transform: function() {},
            translate: function() {},
            scale: function() {},
            rotate: function() {},
            fillText: function() {},
            strokeText: function() {},
            clip: function() {},
            createLinearGradient: function() { return { addColorStop: function() {} }; },
            createRadialGradient: function() { return { addColorStop: function() {} }; },
            createPattern: function() { return null; },
            font: '10px sans-serif',
            textAlign: 'start',
            textBaseline: 'alphabetic',
            fillStyle: '#000',
            strokeStyle: '#000',
            lineWidth: 1,
            lineCap: 'butt',
            lineJoin: 'miter',
            globalAlpha: 1,
            globalCompositeOperation: 'source-over'
          };
        };
        el.toDataURL = function() { return 'data:image/png;base64,'; };
        el.toBlob = function(cb) { cb(new Blob()); };
      }
      return el;
    };

    // WebGL context mock (for @react-three/fiber, etc.)
    HTMLCanvasElement.prototype.getContext = (function(origGetContext) {
      return function(type, attrs) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
          return {
            canvas: this,
            getExtension: function() { return null; },
            getParameter: function() { return 0; },
            createShader: function() { return {}; },
            shaderSource: function() {},
            compileShader: function() {},
            createProgram: function() { return {}; },
            attachShader: function() {},
            linkProgram: function() {},
            useProgram: function() {},
            createBuffer: function() { return {}; },
            bindBuffer: function() {},
            bufferData: function() {},
            enableVertexAttribArray: function() {},
            vertexAttribPointer: function() {},
            createTexture: function() { return {}; },
            bindTexture: function() {},
            texImage2D: function() {},
            texParameteri: function() {},
            clear: function() {},
            clearColor: function() {},
            viewport: function() {},
            drawArrays: function() {},
            drawElements: function() {},
            enable: function() {},
            disable: function() {},
            blendFunc: function() {},
            getShaderParameter: function() { return true; },
            getProgramParameter: function() { return true; },
            getUniformLocation: function() { return 0; },
            getAttribLocation: function() { return 0; },
            uniform1f: function() {},
            uniform2f: function() {},
            uniform3f: function() {},
            uniform4f: function() {},
            uniformMatrix4fv: function() {},
            drawingBufferWidth: 300,
            drawingBufferHeight: 150
          };
        }
        return origGetContext.call(this, type, attrs);
      };
    })(HTMLCanvasElement.prototype.getContext);

    // PointerEvent mock (for drag-and-drop, etc.)
    if (!window.PointerEvent) {
      window.PointerEvent = function(type, opts) {
        var e = new MouseEvent(type, opts);
        e.pointerId = opts?.pointerId || 0;
        e.pointerType = opts?.pointerType || 'mouse';
        return e;
      };
    }

    // DragEvent mock
    if (!window.DragEvent) {
      window.DragEvent = function(type, opts) {
        return new MouseEvent(type, opts);
      };
    }

    // Touch events
    if (!window.TouchEvent) {
      window.TouchEvent = function() { return {}; };
    }

    // console safety
    ['log', 'warn', 'error', 'info', 'debug'].forEach(function(m) {
      if (!console[m]) console[m] = function() {};
    });

    // ========== SAFE PROPS UTILITY ==========
    // Makes any object safe to access - returns safe defaults for undefined
    window.__makeSafeProps__ = function(props) {
      if (!props || typeof props !== 'object') return {};

      var safeHandler = {
        get: function(target, prop) {
          var value = target[prop];

          // If it's undefined or null, return safe default
          if (value === undefined || value === null) {
            // Check prop name to guess type
            var propLower = String(prop).toLowerCase();

            // Array-like prop names
            if (/^(items|data|list|rows|columns|options|values|results|tracks|children|elements|entries|records|users|posts|comments|messages|notifications|events|tasks|files|images|videos|products|orders|categories|tags|features|steps|slides|tabs|panels|cards|fields|inputs|outputs|logs|errors|warnings|suggestions|recommendations|metrics|stats|charts|series|labels|selected|checked|disabled|visible|active|expanded|collapsed)$/.test(propLower) ||
                propLower.endsWith('s') || propLower.endsWith('list') || propLower.endsWith('array') || propLower.endsWith('items')) {
              return [];
            }

            // Callback-like prop names
            if (/^(on[A-Z]|handle|set|toggle|submit|cancel|close|open|save|delete|remove|add|update|create|fetch|load|refresh|render|callback|action)/.test(String(prop))) {
              return function() {};
            }

            // Config/settings object
            if (/^(config|settings|options|params|query|style|styles|theme|context|meta|info|details|state)$/.test(propLower)) {
              return {};
            }

            // Boolean-like
            if (/^(is|has|can|should|will|was|did|does|show|hide|enable|disable|active|visible|open|closed|selected|checked|loading|loaded|ready|valid|invalid|dirty|pristine|touched|untouched)/.test(String(prop))) {
              return false;
            }

            // String-like
            if (/^(id|name|title|label|text|content|description|placeholder|message|error|warning|info|hint|tooltip|value|key|className|class|type|variant|size|color|icon)$/.test(propLower)) {
              return '';
            }

            // Number-like
            if (/^(index|count|total|length|size|width|height|min|max|step|page|limit|offset|duration|delay)$/.test(propLower)) {
              return 0;
            }

            // Default to empty object for any other undefined
            return {};
          }

          // If it's an object/array, make it safe too (recursive)
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            return new Proxy(value, safeHandler);
          }

          return value;
        }
      };

      return new Proxy(props, safeHandler);
    };

    // ========== CONTEXT PROVIDERS ==========
    // All common contexts pre-created

    // Theme Context (next-themes)
    window.__THEME_CONTEXT__ = React.createContext({
      theme: 'light',
      setTheme: function() {},
      resolvedTheme: 'light',
      themes: ['light', 'dark'],
      systemTheme: 'light'
    });

    // Form Context (react-hook-form)
    window.__FORM_CONTEXT__ = React.createContext({
      register: function() { return {}; },
      handleSubmit: function(fn) { return function(e) { e && e.preventDefault && e.preventDefault(); return fn({}); }; },
      watch: function() { return ''; },
      setValue: function() {},
      getValues: function() { return {}; },
      getFieldState: function() { return { invalid: false, isDirty: false, isTouched: false, error: undefined }; },
      formState: { errors: {}, isSubmitting: false, isValid: true, isDirty: false, isValidating: false },
      control: { _formValues: {}, getFieldState: function() { return { invalid: false, isDirty: false, isTouched: false, error: undefined }; } },
      reset: function() {},
      setError: function() {},
      clearErrors: function() {},
      trigger: function() { return Promise.resolve(true); }
    });

    // Router Context (next/navigation)
    window.__ROUTER_CONTEXT__ = React.createContext({
      push: function() {},
      replace: function() {},
      back: function() {},
      forward: function() {},
      prefetch: function() {},
      refresh: function() {},
      pathname: '/',
      query: {},
      params: {},
      asPath: '/',
      searchParams: new URLSearchParams()
    });

    // Auth Context
    window.__AUTH_CONTEXT__ = React.createContext({
      user: { id: '1', email: 'demo@example.com', name: 'Demo User', image: '/avatar.jpg' },
      isAuthenticated: true,
      isLoading: false,
      isSignedIn: true,
      signIn: function() {},
      signOut: function() {},
      session: { user: { id: '1', email: 'demo@example.com', name: 'Demo User' } }
    });

    // Query Context (react-query)
    window.__QUERY_CONTEXT__ = React.createContext({
      invalidateQueries: function() {},
      refetchQueries: function() {},
      getQueryData: function() { return null; },
      setQueryData: function() {},
      getQueryState: function() { return { status: 'success', data: null }; }
    });

    // Toast Context
    window.__TOAST_CONTEXT__ = React.createContext({
      toast: function() { return '1'; },
      toasts: [],
      dismiss: function() {},
      success: function() {},
      error: function() {},
      warning: function() {},
      info: function() {}
    });

    // I18n Context
    window.__I18N_CONTEXT__ = React.createContext({
      t: function(key) { return key; },
      i18n: { language: 'en', changeLanguage: function() { return Promise.resolve(); } },
      locale: 'en',
      messages: {}
    });

    // ========== UNIVERSAL PROVIDER WRAPPER ==========
    window.__UniversalProvider__ = function(props) {
      var children = props.children;

      // Wrap in all providers
      var element = children;
      element = React.createElement(window.__I18N_CONTEXT__.Provider, { value: window.__I18N_CONTEXT__._currentValue }, element);
      element = React.createElement(window.__TOAST_CONTEXT__.Provider, { value: window.__TOAST_CONTEXT__._currentValue }, element);
      element = React.createElement(window.__QUERY_CONTEXT__.Provider, { value: window.__QUERY_CONTEXT__._currentValue }, element);
      element = React.createElement(window.__AUTH_CONTEXT__.Provider, { value: window.__AUTH_CONTEXT__._currentValue }, element);
      element = React.createElement(window.__ROUTER_CONTEXT__.Provider, { value: window.__ROUTER_CONTEXT__._currentValue }, element);
      element = React.createElement(window.__FORM_CONTEXT__.Provider, { value: window.__FORM_CONTEXT__._currentValue }, element);
      element = React.createElement(window.__THEME_CONTEXT__.Provider, { value: window.__THEME_CONTEXT__._currentValue }, element);

      return element;
    };

    // ========== ERROR BOUNDARY ==========
    window.__ErrorBoundary__ = (function() {
      function ErrorBoundary(props) {
        this.state = { hasError: false, error: null };
      }
      ErrorBoundary.prototype = Object.create(React.Component.prototype);
      ErrorBoundary.prototype.constructor = ErrorBoundary;
      ErrorBoundary.getDerivedStateFromError = function(error) {
        return { hasError: true, error: error };
      };
      ErrorBoundary.prototype.componentDidCatch = function(error, info) {
        console.error('[ErrorBoundary]', error, info);
        window.__RENDER_ERRORS__.push({ message: error.message, stack: error.stack, componentStack: info?.componentStack });
      };
      ErrorBoundary.prototype.render = function() {
        if (this.state.hasError) {
          return React.createElement('div', { style: { padding: '20px', color: '#ef4444' } },
            React.createElement('h3', null, 'Component Error'),
            React.createElement('pre', { style: { fontSize: '12px', whiteSpace: 'pre-wrap' } }, this.state.error?.message || 'Unknown error')
          );
        }
        return this.props.children;
      };
      return ErrorBoundary;
    })();
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
        console.log('__SCENERY_COMPONENT__:', typeof window.__SCENERY_COMPONENT__, window.__SCENERY_COMPONENT__);

        var Component = window.__SCENERY_COMPONENT__;

        if (!Component) {
          window.__RENDER_ERROR__ = { message: 'Component not found on window.__SCENERY_COMPONENT__. Check console for bundle errors.' };
          return;
        }

        // Parse props and make them safe
        var rawProps = ${propsJson};
        var props = window.__makeSafeProps__(rawProps);

        // Suspense fallback for lazy components
        var SuspenseFallback = React.createElement('div', {
          style: { padding: '20px', textAlign: 'center', color: '#737373' }
        }, 'Loading...');

        // Create element with safe props, wrapped in Suspense, error boundary and all providers
        var element = React.createElement(Component, props);
        element = React.createElement(React.Suspense, { fallback: SuspenseFallback }, element);
        element = React.createElement(window.__ErrorBoundary__, null, element);
        element = React.createElement(window.__UniversalProvider__, null, element);

        var root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(element);

        // Signal render complete after a delay to let async effects settle
        setTimeout(function() {
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              window.__RENDER_COMPLETE__ = true;
            });
          });
        }, 100);

      } catch (error) {
        console.error('Render error:', error);
        window.__RENDER_ERROR__ = { message: error.message, stack: error.stack };
      }
    })();
  </script>
</body>
</html>`;
}
