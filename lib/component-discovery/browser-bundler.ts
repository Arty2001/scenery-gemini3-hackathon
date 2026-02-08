/**
 * Browser-targeted component bundler for Playwright rendering
 *
 * Bundles React components with all dependencies resolved for execution
 * in a real browser environment. Used by the Playwright worker to render
 * components accurately with hooks, context, and effects.
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';

export interface BrowserBundleOptions {
  sourceCode: string;
  componentName: string;
  repoPath: string;
  sourceCodeMap: Record<string, string>;
}

export interface BrowserBundleResult {
  success: boolean;
  bundledJs?: string;
  error?: string;
}

/**
 * Extract all named imports from source files to know what exports to mock
 * Returns a map of package name -> set of imported names
 */
function extractImportsFromSources(sourceCodeMap: Record<string, string>): Map<string, Set<string>> {
  const importMap = new Map<string, Set<string>>();

  // Regex to match: import { name1, name2 as alias } from 'package'
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  // Regex to match: import name from 'package' (default import)
  const defaultImportRegex = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
  // Regex to match: import * as name from 'package'
  const namespaceImportRegex = /import\s*\*\s*as\s+\w+\s+from\s*['"]([^'"]+)['"]/g;

  for (const sourceCode of Object.values(sourceCodeMap)) {
    // Extract named imports
    let match;
    while ((match = namedImportRegex.exec(sourceCode)) !== null) {
      const imports = match[1];
      const pkg = match[2];

      if (!importMap.has(pkg)) {
        importMap.set(pkg, new Set());
      }

      // Parse individual imports (handling "as" aliases and type imports)
      const names = imports.split(',').map((s: string) => {
        // Normalize whitespace (handles multi-line imports)
        const trimmed = s.replace(/\s+/g, ' ').trim();

        // Skip TypeScript type-only imports: "type Foo" or "type Foo as Bar"
        if (trimmed.startsWith('type ')) {
          return null;
        }

        // Handle "name as alias" - we want the original name
        const asMatch = trimmed.match(/^(\w+)\s+as\s+\w+$/);
        return asMatch ? asMatch[1] : trimmed;
      }).filter((name): name is string => name !== null && Boolean(name) && /^\w+$/.test(name));

      for (const name of names) {
        importMap.get(pkg)!.add(name);
      }
    }

    // Reset regex state
    namedImportRegex.lastIndex = 0;

    // Track packages with default imports
    while ((match = defaultImportRegex.exec(sourceCode)) !== null) {
      const pkg = match[2];
      if (!importMap.has(pkg)) {
        importMap.set(pkg, new Set());
      }
      importMap.get(pkg)!.add('default');
    }
    defaultImportRegex.lastIndex = 0;

    // Track namespace imports
    while ((match = namespaceImportRegex.exec(sourceCode)) !== null) {
      const pkg = match[1];
      if (!importMap.has(pkg)) {
        importMap.set(pkg, new Set());
      }
      // Namespace imports need all exports, mark with special flag
      importMap.get(pkg)!.add('*');
    }
    namespaceImportRegex.lastIndex = 0;
  }

  return importMap;
}

/**
 * Load and parse tsconfig.json to extract path aliases
 */
function loadTsConfigPaths(repoPath: string): Record<string, string[]> {
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');

  try {
    if (!fs.existsSync(tsconfigPath)) {
      return {};
    }

    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    // Remove comments (simple approach for JSON with comments)
    const cleaned = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const config = JSON.parse(cleaned);

    return config.compilerOptions?.paths || {};
  } catch {
    return {};
  }
}

/**
 * Resolve a path alias to its actual path
 */
function resolveAlias(
  importPath: string,
  aliases: Record<string, string[]>,
  repoPath: string
): string | null {
  for (const [alias, targets] of Object.entries(aliases)) {
    // Handle exact match (e.g., "@/*" matching "@/components/Button")
    const aliasPattern = alias.replace('*', '');

    if (importPath.startsWith(aliasPattern)) {
      const remainder = importPath.slice(aliasPattern.length);
      const target = targets[0]?.replace('*', '') || '';
      return path.join(repoPath, target, remainder);
    }
  }

  return null;
}

/**
 * Create inline mocks for common UI libraries
 * These are embedded directly in the bundle for browser execution
 */
function createInlineMocks(): string {
  return `
// Define __makeSafeProps__ if not already defined by the HTML template
// This is a fallback in case the first script block fails
if (typeof window.__makeSafeProps__ !== 'function') {
  window.__makeSafeProps__ = function(props) {
    if (!props || typeof props !== 'object') return {};
    // Simple safe props wrapper - returns empty defaults for undefined values
    return new Proxy(props, {
      get: function(target, prop) {
        var value = target[prop];
        if (value === undefined || value === null) {
          var propLower = String(prop).toLowerCase();
          // Array-like props
          if (propLower.endsWith('s') || propLower.endsWith('list') || propLower.endsWith('items') || propLower.endsWith('data')) return [];
          // Callback props
          if (String(prop).startsWith('on') || String(prop).startsWith('handle')) return function() {};
          // Boolean props
          if (String(prop).startsWith('is') || String(prop).startsWith('has') || String(prop).startsWith('show')) return false;
          // Default to empty object
          return {};
        }
        return value;
      }
    });
  };
  console.log('[bundle] Defined fallback __makeSafeProps__');
}

// Inline mocks for common dependencies
const __mocks__ = {
  // clsx/tailwind-merge - simple class joining
  clsx: (...args) => args.flat().filter(Boolean).join(' '),
  'clsx/lite': (...args) => args.flat().filter(Boolean).join(' '),
  'tailwind-merge': (...args) => args.flat().filter(Boolean).join(' '),

  // class-variance-authority
  cva: (base, config) => (props) => {
    let classes = base || '';
    if (config?.variants && props) {
      for (const [key, value] of Object.entries(props)) {
        const variant = config.variants[key];
        if (variant && variant[value]) {
          classes += ' ' + variant[value];
        }
      }
    }
    return classes;
  },

  // date-fns - return placeholder dates
  'date-fns': new Proxy({}, {
    get: () => () => new Date().toLocaleDateString()
  }),
};

// Lucide React icons - generate SVG components
// Use window.React to ensure it's available from CDN
const createIcon = (name) => {
  return function LucideIcon(props) {
    const R = window.React;
    if (!R) { console.error('[createIcon] window.React not available!'); return null; }
    return R.createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: props?.size || 24,
      height: props?.size || 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: props?.strokeWidth || 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props?.className,
      'data-icon': name.toLowerCase(),
    }, R.createElement('circle', { cx: 12, cy: 12, r: 10 }));
  };
};

const lucideReact = new Proxy({}, {
  get: (_, name) => createIcon(String(name))
});

// Framer Motion - passthrough wrapper
const motion = new Proxy({}, {
  get: (_, tag) => {
    return function MotionComponent(props) {
      const R = window.React;
      if (!R) return null;
      const { children, ...rest } = props || {};
      // Filter out motion-specific props
      const htmlProps = {};
      for (const [key, value] of Object.entries(rest)) {
        if (!key.startsWith('animate') &&
            !key.startsWith('initial') &&
            !key.startsWith('exit') &&
            !key.startsWith('transition') &&
            !key.startsWith('variants') &&
            !key.startsWith('whileHover') &&
            !key.startsWith('whileTap') &&
            key !== 'layout' &&
            key !== 'layoutId') {
          htmlProps[key] = value;
        }
      }
      return R.createElement(String(tag), htmlProps, children);
    };
  }
});

const framerMotion = {
  motion,
  AnimatePresence: ({ children }) => children,
  useAnimation: () => ({}),
  useMotionValue: (v) => ({ get: () => v, set: () => {} }),
  useTransform: () => ({ get: () => 0 }),
  useSpring: (v) => v,
  useScroll: () => ({ scrollY: { get: () => 0 } }),
  useInView: () => true,
};

// Next.js components - use window.React to ensure availability
const nextImage = function NextImage(props) {
  const R = window.React;
  if (!R) { console.error('[nextImage] window.React not available!'); return null; }
  return R.createElement('img', {
    src: props?.src,
    alt: props?.alt || '',
    width: props?.width,
    height: props?.height,
    className: props?.className,
    style: props?.style,
  });
};

const nextLink = function NextLink(props) {
  const R = window.React;
  if (!R) { console.error('[nextLink] window.React not available!'); return null; }
  return R.createElement('a', {
    href: props?.href,
    className: props?.className,
    style: props?.style,
  }, props?.children);
};

// Next.js fonts - return objects with className and variable for CSS custom properties
const createFontMock = (fontName) => (options) => {
  const slug = fontName.toLowerCase().replace(/\s+/g, '-');
  return {
    className: 'font-' + slug,
    variable: '--font-' + slug,
    style: {
      fontFamily: fontName + ', system-ui, sans-serif',
      fontWeight: options?.weight || 400,
      fontStyle: options?.style || 'normal',
    },
  };
};

// Proxy that returns font mock for any font name (Inter, Roboto, etc.)
const nextFontGoogle = new Proxy({}, {
  get: (_, fontName) => createFontMock(String(fontName))
});

const nextFontLocal = createFontMock('LocalFont');

// Radix UI - render as divs with data attributes
const createRadixComponent = (name) => {
  return function RadixComponent(props) {
    const R = window.React;
    if (!R) return null;
    const { children, asChild, ...rest } = props || {};
    return R.createElement('div', {
      'data-radix': name.toLowerCase(),
      ...rest,
    }, children);
  };
};

const radixProxy = new Proxy({}, {
  get: (_, name) => createRadixComponent(String(name))
});

// React Hook Form mock - uses shared __FORM_CONTEXT__ if available
const reactHookForm = {
  useForm: () => ({
    register: () => ({}),
    handleSubmit: (fn) => (e) => { e?.preventDefault?.(); return fn({}); },
    watch: () => '',
    setValue: () => {},
    getValues: () => ({}),
    getFieldState: () => ({ invalid: false, isDirty: false, isTouched: false, error: undefined }),
    formState: { errors: {}, isSubmitting: false, isValid: true, isDirty: false },
    reset: () => {},
    control: {
      register: () => ({}),
      unregister: () => {},
      getFieldState: () => ({ invalid: false, isDirty: false, isTouched: false, error: undefined }),
      _formState: { errors: {}, isSubmitting: false, isValid: true, isDirty: false },
      _fields: {},
    },
  }),
  Controller: ({ render, field }) => render ? render({ field: { value: '', onChange: () => {}, onBlur: () => {}, name: '', ref: () => {} }, fieldState: { invalid: false, isDirty: false, isTouched: false, error: undefined } }) : null,
  FormProvider: ({ children }) => children,
  useFormContext: () => {
    // Use shared form context if available
    const R = window.React;
    if (typeof window !== 'undefined' && window.__FORM_CONTEXT__ && R) {
      try { return R.useContext(window.__FORM_CONTEXT__); } catch (e) {}
    }
    return reactHookForm.useForm();
  },
  useController: () => ({ field: { value: '', onChange: () => {}, onBlur: () => {}, name: '', ref: () => {} }, fieldState: { invalid: false, isDirty: false, isTouched: false, error: undefined } }),
  useWatch: () => '',
  useFieldArray: () => ({ fields: [], append: () => {}, remove: () => {}, prepend: () => {}, swap: () => {}, move: () => {}, insert: () => {}, update: () => {}, replace: () => {} }),
};

// Zod mock (schema validation)
const createZodType = () => {
  const type = {
    parse: (v) => v,
    safeParse: (v) => ({ success: true, data: v }),
    optional: () => createZodType(),
    nullable: () => createZodType(),
    default: () => createZodType(),
    min: () => createZodType(),
    max: () => createZodType(),
    email: () => createZodType(),
    url: () => createZodType(),
    refine: () => createZodType(),
    transform: () => createZodType(),
  };
  return type;
};

const zod = {
  object: () => createZodType(),
  string: () => createZodType(),
  number: () => createZodType(),
  boolean: () => createZodType(),
  array: () => createZodType(),
  enum: () => createZodType(),
  union: () => createZodType(),
  literal: () => createZodType(),
  optional: () => createZodType(),
  nullable: () => createZodType(),
  infer: () => ({}),
  z: null, // will be set below
};
zod.z = zod;

// React Query / TanStack Query mock - uses shared __QUERY_CONTEXT__ if available
const reactQuery = {
  useQuery: () => ({ data: null, isLoading: false, error: null, refetch: () => {}, isFetching: false, isSuccess: true }),
  useMutation: () => ({ mutate: () => {}, mutateAsync: async () => {}, isLoading: false, isPending: false }),
  useQueryClient: () => {
    const R = window.React;
    if (typeof window !== 'undefined' && window.__QUERY_CONTEXT__ && R) {
      try { return R.useContext(window.__QUERY_CONTEXT__); } catch (e) {}
    }
    return { invalidateQueries: () => {}, refetchQueries: () => {}, getQueryData: () => null };
  },
  QueryClient: function() { return {}; },
  QueryClientProvider: ({ children }) => children,
};

// Auth mocks - uses shared __AUTH_CONTEXT__ if available
const authMock = {
  useAuth: () => {
    const R = window.React;
    if (typeof window !== 'undefined' && window.__AUTH_CONTEXT__ && R) {
      try { return R.useContext(window.__AUTH_CONTEXT__); } catch (e) {}
    }
    return { user: { id: '1', email: 'demo@example.com', name: 'Demo User' }, isAuthenticated: true, isLoading: false };
  },
  useUser: () => ({ id: '1', email: 'demo@example.com', name: 'Demo User' }),
  useSession: () => ({ data: { user: { id: '1', email: 'demo@example.com', name: 'Demo User' } }, status: 'authenticated' }),
  useClerk: () => ({ user: { id: '1', email: 'demo@example.com' }, signOut: () => {} }),
  SignIn: () => { const R = window.React; return R ? R.createElement('div', { 'data-clerk': 'sign-in' }, 'Sign In') : null; },
  SignUp: () => { const R = window.React; return R ? R.createElement('div', { 'data-clerk': 'sign-up' }, 'Sign Up') : null; },
  UserButton: () => { const R = window.React; return R ? R.createElement('div', { 'data-clerk': 'user-button' }, 'User') : null; },
  SignedIn: ({ children }) => children,
  SignedOut: ({ children }) => children,
};

// Toast mocks - uses shared __TOAST_CONTEXT__ if available
const toastMock = {
  useToast: () => {
    const R = window.React;
    if (typeof window !== 'undefined' && window.__TOAST_CONTEXT__ && R) {
      try { return R.useContext(window.__TOAST_CONTEXT__); } catch (e) {}
    }
    return { toast: () => '1', toasts: [], dismiss: () => {} };
  },
  toast: () => '1',
};

// i18n mocks - uses shared __I18N_CONTEXT__ if available
const i18nMock = {
  useTranslation: () => {
    const R = window.React;
    if (typeof window !== 'undefined' && window.__I18N_CONTEXT__ && R) {
      try {
        const ctx = R.useContext(window.__I18N_CONTEXT__);
        return { t: ctx.t || ((k) => k), i18n: ctx.i18n || { language: 'en' } };
      } catch (e) {}
    }
    return { t: (k) => k, i18n: { language: 'en', changeLanguage: () => {} } };
  },
  Trans: ({ children }) => children,
  I18nextProvider: ({ children }) => children,
};

// Recharts mock (charting library)
const rechartsComponent = ({ children, ...props }) => {
  const R = window.React;
  return R ? R.createElement('div', { 'data-recharts': 'chart', ...props }, children) : null;
};

const recharts = {
  ResponsiveContainer: rechartsComponent,
  LineChart: rechartsComponent,
  BarChart: rechartsComponent,
  AreaChart: rechartsComponent,
  PieChart: rechartsComponent,
  Line: () => null,
  Bar: () => null,
  Area: () => null,
  Pie: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
};

// Headless UI mock
const headlessUIComponent = ({ children, ...props }) => {
  const R = window.React;
  if (!R) return null;
  return R.createElement('div', { 'data-headlessui': 'component', ...props },
    typeof children === 'function' ? children({ open: true, selected: false }) : children);
};

const headlessUI = {
  Dialog: headlessUIComponent,
  'Dialog.Panel': headlessUIComponent,
  'Dialog.Title': headlessUIComponent,
  Menu: headlessUIComponent,
  'Menu.Button': headlessUIComponent,
  'Menu.Items': headlessUIComponent,
  'Menu.Item': headlessUIComponent,
  Popover: headlessUIComponent,
  Listbox: headlessUIComponent,
  Combobox: headlessUIComponent,
  Switch: headlessUIComponent,
  Tab: headlessUIComponent,
  Disclosure: headlessUIComponent,
  Transition: ({ children }) => children,
  Fragment: (typeof window !== 'undefined' && window.React) ? window.React.Fragment : ({ children }) => children,
};

// React Spring mock
const reactSpring = {
  useSpring: () => [{ opacity: 1 }, () => {}],
  useSprings: () => [[], () => {}],
  useTrail: () => [[], () => {}],
  useTransition: () => [],
  animated: new Proxy({}, {
    get: (_, tag) => (props) => {
      const R = window.React;
      return R ? R.createElement(String(tag), props) : null;
    }
  }),
  config: { default: {}, gentle: {}, stiff: {}, wobbly: {} },
};

// Sonner/toast mock
const sonner = {
  toast: () => {},
  Toaster: () => { const R = window.React; return R ? R.createElement('div', { 'data-sonner': 'toaster' }) : null; },
};

// React Hot Toast mock
const reactHotToast = {
  default: () => {},
  toast: () => {},
  Toaster: () => { const R = window.React; return R ? R.createElement('div', { 'data-hot-toast': 'toaster' }) : null; },
};

// Export mocks for use in bundle
// Verify React is available before setting up mocks
if (!window.React) {
  console.error('[mocks] CRITICAL: window.React is not available! Mocks that render elements will fail.');
}

window.__SCENERY_MOCKS__ = {
  ...(__mocks__),
  'lucide-react': lucideReact,
  'framer-motion': framerMotion,
  'next/image': { default: nextImage },
  'next/link': { default: nextLink },
  'next/navigation': {
    useRouter: () => {
      // Use shared router context if available
      const R = window.React;
      if (typeof window !== 'undefined' && window.__ROUTER_CONTEXT__ && R) {
        try { return R.useContext(window.__ROUTER_CONTEXT__); } catch (e) {}
      }
      return { push: () => {}, replace: () => {}, back: () => {}, forward: () => {}, prefetch: () => {}, refresh: () => {} };
    },
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    redirect: () => {},
    notFound: () => {},
  },
  'next/router': {
    useRouter: () => {
      const R = window.React;
      if (typeof window !== 'undefined' && window.__ROUTER_CONTEXT__ && R) {
        try { return R.useContext(window.__ROUTER_CONTEXT__); } catch (e) {}
      }
      return { push: () => {}, replace: () => {}, pathname: '/', query: {}, asPath: '/', events: { on: () => {}, off: () => {} } };
    },
  },
  'next/font/google': nextFontGoogle,
  'next/font/local': { default: nextFontLocal },
  'next/dynamic': (fn) => fn,

  // Form libraries
  'react-hook-form': reactHookForm,
  'zod': zod,
  '@hookform/resolvers/zod': { zodResolver: () => () => ({ values: {}, errors: {} }) },

  // Query libraries
  '@tanstack/react-query': reactQuery,
  'react-query': reactQuery,

  // Charting
  'recharts': recharts,

  // Headless UI
  '@headlessui/react': headlessUI,

  // Animation
  '@react-spring/web': reactSpring,
  'react-spring': reactSpring,

  // Toast
  'sonner': sonner,
  'react-hot-toast': reactHotToast,

  // Additional utilities
  'react-icons': new Proxy({}, {
    get: () => new Proxy({}, {
      get: (_, name) => createIcon(String(name))
    })
  }),
  'react-icons/fa': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/fa6': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/fi': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/hi': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/hi2': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/md': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/io': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/io5': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/bi': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/bs': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/ai': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/ri': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/si': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/gi': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/pi': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/tb': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/lu': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/rx': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  'react-icons/vsc': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  '@heroicons/react/24/solid': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  '@heroicons/react/24/outline': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  '@heroicons/react/20/solid': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  '@phosphor-icons/react': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),
  '@tabler/icons-react': new Proxy({}, { get: (_, name) => createIcon(String(name)) }),

  // Date libraries
  'dayjs': () => ({
    format: () => new Date().toLocaleDateString(),
    add: () => ({ format: () => new Date().toLocaleDateString() }),
    subtract: () => ({ format: () => new Date().toLocaleDateString() }),
    isValid: () => true,
  }),
  'moment': () => ({
    format: () => new Date().toLocaleDateString(),
    add: () => ({ format: () => new Date().toLocaleDateString() }),
    subtract: () => ({ format: () => new Date().toLocaleDateString() }),
  }),

  // State management libraries
  'zustand': {
    create: (fn) => {
      const state = typeof fn === 'function' ? fn(() => {}, () => state, { setState: () => {}, getState: () => state }) : fn;
      const useStore = (selector) => selector ? selector(state) : state;
      useStore.getState = () => state;
      useStore.setState = () => {};
      useStore.subscribe = () => () => {};
      return useStore;
    },
    createStore: (fn) => fn,
  },
  'zustand/middleware': {
    persist: (fn) => fn,
    devtools: (fn) => fn,
    subscribeWithSelector: (fn) => fn,
    combine: (a, b) => ({ ...a, ...b }),
  },
  'jotai': {
    atom: (init) => ({ init }),
    useAtom: () => [null, () => {}],
    useAtomValue: () => null,
    useSetAtom: () => () => {},
    Provider: ({ children }) => children,
  },
  'jotai/utils': {
    atomWithStorage: (key, init) => ({ key, init }),
    atomWithReset: (init) => ({ init }),
    useResetAtom: () => () => {},
    useHydrateAtoms: () => {},
  },
  'recoil': {
    atom: (config) => config,
    selector: (config) => config,
    useRecoilState: () => [null, () => {}],
    useRecoilValue: () => null,
    useSetRecoilState: () => () => {},
    useResetRecoilState: () => () => {},
    RecoilRoot: ({ children }) => children,
  },
  'valtio': {
    proxy: (obj) => obj,
    useSnapshot: (obj) => obj,
    subscribe: () => () => {},
    ref: (obj) => obj,
  },

  // SWR
  'swr': {
    default: () => ({ data: null, error: null, isLoading: false, isValidating: false, mutate: () => {} }),
    useSWR: () => ({ data: null, error: null, isLoading: false, isValidating: false, mutate: () => {} }),
    useSWRConfig: () => ({ mutate: () => {}, cache: new Map() }),
    SWRConfig: ({ children }) => children,
  },

  // Drag and drop
  '@dnd-kit/core': {
    DndContext: ({ children }) => children,
    useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
    DragOverlay: ({ children }) => children,
    useSensor: () => ({}),
    useSensors: () => [],
    PointerSensor: {},
    KeyboardSensor: {},
    closestCenter: () => null,
  },
  '@dnd-kit/sortable': {
    SortableContext: ({ children }) => children,
    useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, transition: null, isDragging: false }),
    sortableKeyboardCoordinates: () => ({}),
    arrayMove: (arr, from, to) => arr,
    verticalListSortingStrategy: {},
    horizontalListSortingStrategy: {},
  },
  '@dnd-kit/utilities': {
    CSS: { Transform: { toString: () => '' } },
  },

  // React Three Fiber (3D) - stub that doesn't render anything
  '@react-three/fiber': {
    Canvas: ({ children }) => { const R = window.React; return R ? R.createElement('div', { 'data-r3f': 'canvas' }, 'WebGL not supported in preview') : null; },
    useFrame: () => {},
    useThree: () => ({ camera: {}, scene: {}, gl: {}, size: { width: 100, height: 100 } }),
    useLoader: () => null,
    extend: () => {},
  },
  '@react-three/drei': new Proxy({}, {
    get: (_, name) => (props) => { const R = window.React; return R ? R.createElement('div', { 'data-drei': String(name).toLowerCase() }) : null; }
  }),

  // Remotion (video) - stub
  'remotion': {
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 300 }),
    Composition: () => null,
    Sequence: ({ children }) => children,
    AbsoluteFill: ({ children, ...props }) => { const R = window.React; return R ? R.createElement('div', { style: { position: 'absolute', inset: 0 }, ...props }, children) : null; },
    Audio: () => null,
    Video: () => null,
    Img: (props) => { const R = window.React; return R ? R.createElement('img', props) : null; },
    spring: () => 0,
    interpolate: () => 0,
    continueRender: () => {},
    delayRender: () => 0,
  },

  // Formik
  'formik': {
    useFormik: () => ({
      values: {},
      errors: {},
      touched: {},
      handleChange: () => {},
      handleBlur: () => {},
      handleSubmit: () => {},
      setFieldValue: () => {},
      setFieldTouched: () => {},
      resetForm: () => {},
      isSubmitting: false,
      isValid: true,
    }),
    Formik: ({ children }) => typeof children === 'function' ? children({}) : children,
    Form: ({ children }) => { const R = window.React; return R ? R.createElement('form', null, children) : null; },
    Field: (props) => { const R = window.React; return R ? R.createElement('input', props) : null; },
    ErrorMessage: () => null,
  },

  // React Hook Form (enhance existing)
  '@hookform/error-message': {
    ErrorMessage: () => null,
  },

  // Embla Carousel
  'embla-carousel-react': {
    default: () => [() => {}, { scrollPrev: () => {}, scrollNext: () => {}, canScrollPrev: () => false, canScrollNext: () => false, selectedScrollSnap: () => 0 }],
    useEmblaCarousel: () => [() => {}, { scrollPrev: () => {}, scrollNext: () => {}, canScrollPrev: () => false, canScrollNext: () => false }],
  },

  // Swiper
  'swiper/react': {
    Swiper: ({ children }) => { const R = window.React; return R ? R.createElement('div', { 'data-swiper': 'container' }, children) : null; },
    SwiperSlide: ({ children }) => { const R = window.React; return R ? R.createElement('div', { 'data-swiper': 'slide' }, children) : null; },
    useSwiper: () => ({ slidePrev: () => {}, slideNext: () => {}, slideTo: () => {} }),
  },

  // React Player
  'react-player': {
    default: () => { const R = window.React; return R ? R.createElement('div', { 'data-player': 'video' }, 'Video Player') : null; },
  },

  // React PDF
  '@react-pdf/renderer': {
    Document: ({ children }) => children,
    Page: ({ children }) => children,
    View: ({ children }) => { const R = window.React; return R ? R.createElement('div', null, children) : null; },
    Text: ({ children }) => { const R = window.React; return R ? R.createElement('span', null, children) : null; },
    Image: (props) => { const R = window.React; return R ? R.createElement('img', props) : null; },
    StyleSheet: { create: (styles) => styles },
    PDFViewer: ({ children }) => children,
  },

  // React Markdown
  'react-markdown': {
    default: ({ children }) => { const R = window.React; return R ? R.createElement('div', { 'data-markdown': true }, children) : null; },
  },

  // Highlight.js / Prism
  'react-syntax-highlighter': {
    Prism: ({ children }) => { const R = window.React; return R ? R.createElement('pre', null, R.createElement('code', null, children)) : null; },
    Light: ({ children }) => { const R = window.React; return R ? R.createElement('pre', null, R.createElement('code', null, children)) : null; },
  },
  'react-syntax-highlighter/dist/esm/styles/prism': new Proxy({}, { get: () => ({}) }),
  'react-syntax-highlighter/dist/esm/styles/hljs': new Proxy({}, { get: () => ({}) }),
};

// next-themes mock for useTheme - uses global ThemeContext if available
const nextThemes = {
  useTheme: () => {
    // Try to use the global ThemeContext from html-template if available
    const R = window.React;
    if (typeof window !== 'undefined' && window.__THEME_CONTEXT__ && R) {
      try {
        return R.useContext(window.__THEME_CONTEXT__);
      } catch (e) {
        // Fallback if useContext fails (called outside render)
      }
    }
    // Default fallback
    return {
      theme: 'light',
      setTheme: () => {},
      resolvedTheme: 'light',
      themes: ['light', 'dark'],
      systemTheme: 'light',
    };
  },
  ThemeProvider: ({ children }) => children,
};

window.__SCENERY_MOCKS__['next-themes'] = nextThemes;

// Auth libraries
window.__SCENERY_MOCKS__['@clerk/nextjs'] = authMock;
window.__SCENERY_MOCKS__['@clerk/clerk-react'] = authMock;
window.__SCENERY_MOCKS__['next-auth/react'] = { ...authMock, signIn: () => {}, signOut: () => {}, getSession: async () => null };
window.__SCENERY_MOCKS__['@auth/nextjs'] = authMock;

// Toast libraries (override with context-aware version)
window.__SCENERY_MOCKS__['sonner'] = { ...sonner, ...toastMock };
window.__SCENERY_MOCKS__['react-hot-toast'] = { ...reactHotToast, ...toastMock };
window.__SCENERY_MOCKS__['@/hooks/use-toast'] = toastMock;
window.__SCENERY_MOCKS__['@/components/ui/use-toast'] = toastMock;

// i18n libraries
window.__SCENERY_MOCKS__['react-i18next'] = i18nMock;
window.__SCENERY_MOCKS__['next-intl'] = { ...i18nMock, useMessages: () => ({}), useLocale: () => 'en', useNow: () => new Date(), useTimeZone: () => 'UTC' };
window.__SCENERY_MOCKS__['react-intl'] = { ...i18nMock, FormattedMessage: ({ id }) => id, IntlProvider: ({ children }) => children };

// Create Radix proxies for all common packages
// The proxy supports both direct access (radixProxy.Root) and module patterns
const radixPackages = [
  '@radix-ui/react-dialog',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-popover',
  '@radix-ui/react-tooltip',
  '@radix-ui/react-tabs',
  '@radix-ui/react-accordion',
  '@radix-ui/react-select',
  '@radix-ui/react-checkbox',
  '@radix-ui/react-radio-group',
  '@radix-ui/react-switch',
  '@radix-ui/react-slider',
  '@radix-ui/react-scroll-area',
  '@radix-ui/react-avatar',
  '@radix-ui/react-alert-dialog',
  '@radix-ui/react-aspect-ratio',
  '@radix-ui/react-collapsible',
  '@radix-ui/react-context-menu',
  '@radix-ui/react-hover-card',
  '@radix-ui/react-menubar',
  '@radix-ui/react-navigation-menu',
  '@radix-ui/react-progress',
  '@radix-ui/react-separator',
  '@radix-ui/react-toggle',
  '@radix-ui/react-toggle-group',
  '@radix-ui/react-label',
  '@radix-ui/react-slot',
  '@radix-ui/react-primitive',
  '@radix-ui/react-toast',
];

radixPackages.forEach(pkg => {
  window.__SCENERY_MOCKS__[pkg] = radixProxy;
});
`;
}

/**
 * Bundle a component for browser execution with Playwright
 */
export async function bundleForBrowser(
  options: BrowserBundleOptions
): Promise<BrowserBundleResult> {
  const { sourceCode, componentName, repoPath, sourceCodeMap } = options;

  try {
    // Load tsconfig path aliases
    const aliases = loadTsConfigPaths(repoPath);

    // Extract all imports from source files to know what to mock
    const allSourceCode = { ...sourceCodeMap, '__main__': sourceCode };
    const importMap = extractImportsFromSources(allSourceCode);

    // Create the entry source that wraps the component
    // Try named export first, then check for default at runtime
    const entrySource = `
import * as __AllExports from '__component__';
// Debug: log available exports
console.log('[bundle] Available exports:', Object.keys(__AllExports));
console.log('[bundle] Looking for component:', '${componentName}');

// Find the component - try named export, then default, then the module itself
const __keys = Object.keys(__AllExports);
let Component = __AllExports['${componentName}'];
console.log('[bundle] Direct lookup result:', typeof Component);

if (!Component && __keys.includes('default')) {
  Component = __AllExports['default'];
  console.log('[bundle] Using default export:', typeof Component);
}
if (!Component && __keys.length === 1) {
  Component = __AllExports[__keys[0]];
  console.log('[bundle] Using single export:', typeof Component);
}

console.log('[bundle] Final Component:', typeof Component, Component?.name || 'anonymous');
window.__SCENERY_COMPONENT__ = Component || function() { return null; };
console.log('[bundle] Set window.__SCENERY_COMPONENT__:', typeof window.__SCENERY_COMPONENT__);
`;

    // Build with esbuild
    const buildResult = await esbuild.build({
      stdin: {
        contents: entrySource,
        loader: 'tsx',
        resolveDir: repoPath,
      },
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      minify: false,
      logLevel: 'silent',
      jsx: 'automatic',
      jsxImportSource: 'react',
      define: {
        'process.env.NODE_ENV': '"production"',
        'process.env': '{}',
      },
      // Don't use external - IIFE format doesn't handle it well in browsers
      // Instead, we inject React from global scope via plugin
      plugins: [
        {
          name: 'scenery-browser-bundler',
          setup(build) {
            // Serve the main component source as a virtual module
            build.onResolve({ filter: /^__component__$/ }, () => ({
              path: '__component__',
              namespace: 'virtual',
            }));
            build.onLoad({ filter: /^__component__$/, namespace: 'virtual' }, () => ({
              contents: sourceCode,
              loader: 'tsx',
              resolveDir: repoPath,
            }));

            // Handle path aliases (e.g., @/components/ui/button)
            build.onResolve({ filter: /^[@~]/ }, (args) => {
              const resolved = resolveAlias(args.path, aliases, repoPath);
              if (resolved) {
                // Check if it's in our source map
                const normalizedPath = resolved.replace(/\\/g, '/');
                for (const [filePath, content] of Object.entries(sourceCodeMap)) {
                  const normalizedFilePath = filePath.replace(/\\/g, '/');
                  // Try matching with various extensions
                  const variations = [
                    normalizedPath,
                    normalizedPath + '.tsx',
                    normalizedPath + '.ts',
                    normalizedPath + '.jsx',
                    normalizedPath + '.js',
                    normalizedPath + '/index.tsx',
                    normalizedPath + '/index.ts',
                  ];

                  for (const variant of variations) {
                    if (normalizedFilePath.endsWith(variant.replace(repoPath.replace(/\\/g, '/'), ''))) {
                      return {
                        path: filePath,
                        namespace: 'repo-source',
                      };
                    }
                  }
                }
              }

              // Fallback to external with mock
              return { path: args.path, namespace: 'mocked' };
            });

            // Handle relative imports from repo source files
            build.onResolve({ filter: /^\./ }, (args) => {
              if (args.namespace === 'repo-source' || args.namespace === 'virtual') {
                const dir = path.dirname(args.importer === '__component__' ? '' : args.importer);
                const resolved = path.resolve(dir || repoPath, args.path);
                const normalizedPath = resolved.replace(/\\/g, '/');

                // Look in source map
                for (const [filePath] of Object.entries(sourceCodeMap)) {
                  const normalizedFilePath = filePath.replace(/\\/g, '/');
                  const variations = [
                    normalizedPath,
                    normalizedPath + '.tsx',
                    normalizedPath + '.ts',
                    normalizedPath + '.jsx',
                    normalizedPath + '.js',
                    normalizedPath + '/index.tsx',
                    normalizedPath + '/index.ts',
                  ];

                  for (const variant of variations) {
                    if (normalizedFilePath === variant || normalizedFilePath.endsWith(variant.split('/').pop() || '')) {
                      return {
                        path: filePath,
                        namespace: 'repo-source',
                      };
                    }
                  }
                }
              }

              return { path: args.path, namespace: 'mocked' };
            });

            // Load repo source files
            build.onLoad({ filter: /.*/, namespace: 'repo-source' }, (args) => {
              const content = sourceCodeMap[args.path];
              if (content) {
                return {
                  contents: content,
                  loader: args.path.endsWith('.tsx') ? 'tsx' :
                          args.path.endsWith('.ts') ? 'ts' :
                          args.path.endsWith('.jsx') ? 'jsx' : 'js',
                  resolveDir: path.dirname(args.path),
                };
              }
              return { contents: '', loader: 'js' };
            });

            // Handle React packages - inject from global window.React
            build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => {
              return { path: args.path, namespace: 'react-global' };
            });

            build.onLoad({ filter: /.*/, namespace: 'react-global' }, (args) => {
              // Provide React and ReactDOM from global scope (loaded via CDN)
              const isReactDom = args.path.startsWith('react-dom');

              if (isReactDom) {
                return {
                  contents: `
                    var ReactDOM = window.ReactDOM;
                    if (!ReactDOM) {
                      console.error('[react-dom] window.ReactDOM is undefined! CDN may have failed to load.');
                      ReactDOM = { createRoot: function() { return { render: function() {} }; } };
                    }
                    export default ReactDOM;
                    export var createRoot = ReactDOM.createRoot || function() { return { render: function() {} }; };
                    export var hydrateRoot = ReactDOM.hydrateRoot || function() { return { render: function() {} }; };
                    export var createPortal = ReactDOM.createPortal || function(children) { return children; };
                    export var flushSync = ReactDOM.flushSync || function(fn) { return fn(); };
                    export var render = ReactDOM.render || function() {};
                    export var hydrate = ReactDOM.hydrate || function() {};
                  `,
                  loader: 'js',
                };
              }

              // For React and JSX runtime - provide robust fallbacks for all exports
              // This handles: react, react/jsx-runtime, react/jsx-runtime.js, etc.
              return {
                contents: `
                  // Get React from window - should be loaded by CDN
                  var React = window.React;

                  console.log('[react-global] React from window:', !!React, React ? 'has createElement: ' + !!React.createElement : 'N/A');

                  // Fallback createElement that creates a proper React-like element with $$typeof
                  // This is critical - React checks for $$typeof to validate elements
                  var REACT_ELEMENT_TYPE = (typeof Symbol === 'function' && Symbol.for) ? Symbol.for('react.element') : 0xeac7;

                  function fallbackCreateElement(type, props) {
                    var children = Array.prototype.slice.call(arguments, 2);
                    console.warn('[react-global] Using fallback createElement for:', type);
                    // Return a proper React element shape with $$typeof
                    return {
                      $$typeof: REACT_ELEMENT_TYPE,
                      type: type || 'div',
                      key: null,
                      ref: null,
                      props: Object.assign({}, props || {}, children.length > 0 ? { children: children.length === 1 ? children[0] : children } : {}),
                      _owner: null
                    };
                  }

                  // Real createElement reference
                  var realCreateElement = (React && React.createElement) ? React.createElement.bind(React) : fallbackCreateElement;

                  // CRITICAL: Safe JSX wrapper that catches undefined element types (React #130)
                  // JSX runtime signature: jsx(type, props, key) where children are in props.children
                  function safeJsx(type, props, key) {
                    // Check if type is undefined, null, or not a valid element type
                    if (type === undefined || type === null) {
                      console.warn('[safeJsx] Element type is undefined/null! Props:', JSON.stringify(props || {}).slice(0, 200));
                      // Return a valid React element that renders nothing
                      return {
                        $$typeof: REACT_ELEMENT_TYPE,
                        type: 'div',
                        key: key || null,
                        ref: null,
                        props: { 'data-jsx-error': 'undefined-component', style: { display: 'none' } },
                        _owner: null
                      };
                    }

                    // Check for invalid types (not string, function, or valid React element type)
                    var typeOf = typeof type;
                    if (typeOf !== 'string' && typeOf !== 'function') {
                      // Check if it's a valid React type (memo, forwardRef, etc. have $$typeof)
                      if (typeOf === 'object' && type !== null && (type.$$typeof || type.render)) {
                        // Valid React component type (forwardRef, memo, etc.)
                      } else {
                        console.warn('[safeJsx] Invalid element type:', typeOf, type);
                        return {
                          $$typeof: REACT_ELEMENT_TYPE,
                          type: 'div',
                          key: key || null,
                          ref: null,
                          props: { 'data-jsx-error': 'invalid-type-' + typeOf, style: { display: 'none' } },
                          _owner: null
                        };
                      }
                    }

                    // Valid type - use React.createElement if available
                    // JSX runtime passes children inside props, but createElement expects them as extra args
                    // So we need to properly extract children from props
                    try {
                      if (React && React.createElement) {
                        // Extract children from props (JSX runtime puts them there)
                        var children = props ? props.children : undefined;
                        var propsWithoutChildren = {};
                        if (props) {
                          for (var k in props) {
                            if (k !== 'children') propsWithoutChildren[k] = props[k];
                          }
                        }
                        // Add key to props if provided
                        if (key !== undefined && key !== null) {
                          propsWithoutChildren.key = key;
                        }
                        // Call createElement with proper signature
                        if (children !== undefined) {
                          if (Array.isArray(children)) {
                            return React.createElement.apply(React, [type, propsWithoutChildren].concat(children));
                          } else {
                            return React.createElement(type, propsWithoutChildren, children);
                          }
                        } else {
                          return React.createElement(type, propsWithoutChildren);
                        }
                      } else {
                        // Fallback: create element manually
                        return fallbackCreateElement(type, props);
                      }
                    } catch (err) {
                      console.error('[safeJsx] createElement error for type:', type, 'error:', err.message);
                      return {
                        $$typeof: REACT_ELEMENT_TYPE,
                        type: 'div',
                        key: key || null,
                        ref: null,
                        props: { 'data-jsx-error': err.message, style: { display: 'none' } },
                        _owner: null
                      };
                    }
                  }

                  // CRITICAL: Set on window for global access
                  window.jsx = safeJsx;
                  window.jsxs = safeJsx;
                  window.jsxDEV = safeJsx;

                  console.log('[react-global] safeJsx defined and set on window');

                  // Export React default
                  export default React || {};

                  // Explicit named exports with fallbacks (avoid destructuring undefined)
                  // Use safeJsx for createElement to catch undefined types everywhere
                  export var createElement = safeJsx;
                  export var createContext = (React && React.createContext) || function(defaultValue) { return { Provider: function(p) { return p.children; }, Consumer: function(p) { return p.children; }, _currentValue: defaultValue }; };
                  export var createRef = (React && React.createRef) || function() { return { current: null }; };
                  export var forwardRef = (React && React.forwardRef) || function(render) { return render; };
                  export var memo = (React && React.memo) || function(component) { return component; };
                  export var lazy = (React && React.lazy) || function(factory) { return factory; };
                  export var Suspense = (React && React.Suspense) || function(props) { return props.children; };
                  export var Fragment = (React && React.Fragment) || 'div';

                  // Hooks with fallbacks
                  export var useState = (React && React.useState) || function(initial) { return [initial, function() {}]; };
                  export var useEffect = (React && React.useEffect) || function() {};
                  export var useContext = (React && React.useContext) || function(ctx) { return ctx._currentValue || {}; };
                  export var useReducer = (React && React.useReducer) || function(reducer, initial) { return [initial, function() {}]; };
                  export var useCallback = (React && React.useCallback) || function(fn) { return fn; };
                  export var useMemo = (React && React.useMemo) || function(fn) { return fn(); };
                  export var useRef = (React && React.useRef) || function(initial) { return { current: initial }; };
                  export var useImperativeHandle = (React && React.useImperativeHandle) || function() {};
                  export var useLayoutEffect = (React && React.useLayoutEffect) || function() {};
                  export var useDebugValue = (React && React.useDebugValue) || function() {};
                  export var useId = (React && React.useId) || function() { return 'id-' + Math.random().toString(36).slice(2); };
                  export var useSyncExternalStore = (React && React.useSyncExternalStore) || function(subscribe, getSnapshot) { return getSnapshot(); };
                  export var useTransition = (React && React.useTransition) || function() { return [false, function(fn) { fn(); }]; };
                  export var useDeferredValue = (React && React.useDeferredValue) || function(value) { return value; };

                  // Other React exports
                  export var Children = (React && React.Children) || { map: function(c,f){return c?c.map(f):[];}, forEach: function(){}, count: function(c){return c?c.length:0;}, only: function(c){return c;}, toArray: function(c){return c||[];} };
                  export var Component = (React && React.Component) || function() {};
                  export var PureComponent = (React && React.PureComponent) || function() {};
                  export var StrictMode = (React && React.StrictMode) || Fragment;
                  export var Profiler = (React && React.Profiler) || function(props) { return props.children; };
                  export var cloneElement = (React && React.cloneElement) || function(el) { return el; };
                  export var isValidElement = (React && React.isValidElement) || function() { return true; };

                  // JSX runtime exports - CRITICAL for component rendering
                  // jsx(type, props, key) - used for elements with single child or no children
                  // jsxs(type, props, key) - used for elements with multiple children
                  export var jsx = safeJsx;
                  export var jsxs = safeJsx;
                  export var jsxDEV = safeJsx;

                  console.log('[react-global] jsx/jsxs set on window:', typeof window.jsx, typeof window.jsxs);
                `,
                loader: 'js',
              };
            });

            // Handle CSS imports (including CSS modules)
            build.onResolve({ filter: /\.css$/ }, (args) => {
              return { path: args.path, namespace: 'css-stub' };
            });
            build.onLoad({ filter: /.*/, namespace: 'css-stub' }, (args) => {
              // Return an empty object for CSS modules, no-op for regular CSS
              const isModule = args.path.includes('.module.');
              if (isModule) {
                return {
                  contents: `
                    // CSS Module stub - returns empty object with Proxy for any class access
                    export default new Proxy({}, { get: (_, name) => String(name) });
                  `,
                  loader: 'js',
                };
              }
              return { contents: '', loader: 'js' };
            });

            // Handle SVG imports (as React components)
            build.onResolve({ filter: /\.svg$/ }, (args) => {
              return { path: args.path, namespace: 'svg-stub' };
            });
            build.onLoad({ filter: /.*/, namespace: 'svg-stub' }, (args) => {
              const name = args.path.split('/').pop()?.replace('.svg', '') || 'Svg';
              return {
                contents: `
                  // SVG stub component
                  const SvgComponent = (props) => React.createElement('svg', {
                    xmlns: 'http://www.w3.org/2000/svg',
                    width: 24,
                    height: 24,
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    'data-svg': '${name}',
                    ...props,
                  });
                  export default SvgComponent;
                  export const ReactComponent = SvgComponent;
                `,
                loader: 'js',
              };
            });

            // Handle image imports
            build.onResolve({ filter: /\.(png|jpe?g|gif|webp|ico|bmp)$/ }, (args) => {
              return { path: args.path, namespace: 'image-stub' };
            });
            build.onLoad({ filter: /.*/, namespace: 'image-stub' }, (args) => {
              return {
                contents: `export default '${args.path}';`,
                loader: 'js',
              };
            });

            // Handle JSON imports
            build.onResolve({ filter: /\.json$/ }, (args) => {
              // Try to resolve from repo source map first
              return { path: args.path, namespace: 'json-stub' };
            });
            build.onLoad({ filter: /.*/, namespace: 'json-stub' }, () => {
              return { contents: 'export default {};', loader: 'js' };
            });

            // Handle mocked/external packages
            build.onResolve({ filter: /.*/ }, (args) => {
              if (args.kind === 'entry-point') return undefined;

              // Everything else gets mocked
              return { path: args.path, namespace: 'mocked' };
            });

            // Generate mock code for external packages
            build.onLoad({ filter: /.*/, namespace: 'mocked' }, (args) => {
              const pkgName = args.path;

              // Get the specific imports used for this package from our analysis
              const packageImports = importMap.get(pkgName) || new Set();
              const namedImportList = Array.from(packageImports)
                .filter(name => name !== 'default' && name !== '*');

              // Check if this is an internal app import (data fetching, actions, etc.)
              // These need async function mocks that return empty data
              const isInternalImport = pkgName.startsWith('@/') || pkgName.startsWith('~/');
              const isActionsImport = pkgName.includes('/actions') || pkgName.includes('/api');
              const isDataImport = pkgName.includes('/lib/') || pkgName.includes('/data') || pkgName.includes('/services');

              // For internal imports, create smart async mocks
              let internalMockSetup = '';
              if (isInternalImport) {
                internalMockSetup = `
// Internal import mock: ${pkgName}
const asyncMock = async function() { return null; };
const dataMock = function() { return null; };
const componentMock = function(props) { return props?.children || null; };
`;
                // If we know specific imports, mock them appropriately
                if (namedImportList.length > 0) {
                  internalMockSetup += namedImportList.map(name => {
                    // Detect the type of function based on name
                    if (name.startsWith('get') || name.startsWith('fetch') || name.startsWith('load')) {
                      return `export const ${name} = async function() { console.log('[mock] ${pkgName}.${name} called'); return null; };`;
                    } else if (name.startsWith('create') || name.startsWith('update') || name.startsWith('delete') || name.startsWith('log') || name.startsWith('save')) {
                      return `export const ${name} = async function() { console.log('[mock] ${pkgName}.${name} called'); return { success: true }; };`;
                    } else if (name.startsWith('use')) {
                      return `export const ${name} = function() { return {}; };`;
                    } else if (name[0] === name[0].toUpperCase()) {
                      // Capitalized = likely a component
                      return `export const ${name} = function(props) { return props?.children || null; };`;
                    } else {
                      return `export const ${name} = function() { return null; };`;
                    }
                  }).join('\n');
                  // Return early for internal imports with known exports
                  return {
                    contents: `${internalMockSetup}\nexport default function() { return null; };`,
                    loader: 'js',
                  };
                }
              }

              // Build export statements for exactly what's imported
              // These check the registered mock first (works with Proxy), then fall back to mockFn
              const namedExports = namedImportList
                .map(name => `export const ${name} = registeredMock ? (registeredMock['${name}'] ?? mockFn) : mockFn;`)
                .join('\n');

              // Check if this is a Radix UI package - needs common component part exports
              const isRadixPackage = pkgName.startsWith('@radix-ui/react-');

              // Debug logging only for undefined exports
              const debugLog = '';

              // Common Radix component parts that need to be exported for namespace imports
              // Helper to safely get a mock value - always returns a function (component)
              const radixParts = isRadixPackage ? `
// Helper to safely get Radix component - always returns a function
function getRadixPart(name) {
  if (registeredMock && typeof registeredMock[name] === 'function') return registeredMock[name];
  if (typeof registeredMock === 'function') return registeredMock;
  return safePlaceholder;
}
// Radix component parts for namespace imports (import * as XPrimitive)
export var Root = getRadixPart('Root');
export var Trigger = getRadixPart('Trigger');
export var Content = getRadixPart('Content');
export var Portal = getRadixPart('Portal');
export var Overlay = getRadixPart('Overlay');
export var Title = getRadixPart('Title');
export var Description = getRadixPart('Description');
export var Close = getRadixPart('Close');
export var Action = getRadixPart('Action');
export var Cancel = getRadixPart('Cancel');
export var Item = getRadixPart('Item');
export var ItemText = getRadixPart('ItemText');
export var ItemIndicator = getRadixPart('ItemIndicator');
export var Group = getRadixPart('Group');
export var Label = getRadixPart('Label');
export var Separator = getRadixPart('Separator');
export var Arrow = getRadixPart('Arrow');
export var Value = getRadixPart('Value');
export var Icon = getRadixPart('Icon');
export var Viewport = getRadixPart('Viewport');
export var ScrollUpButton = getRadixPart('ScrollUpButton');
export var ScrollDownButton = getRadixPart('ScrollDownButton');
export var Track = getRadixPart('Track');
export var Range = getRadixPart('Range');
export var Thumb = getRadixPart('Thumb');
export var Header = getRadixPart('Header');
export var Body = getRadixPart('Body');
export var Footer = getRadixPart('Footer');
export var List = getRadixPart('List');
export var Indicator = getRadixPart('Indicator');
export var Image = getRadixPart('Image');
export var Fallback = getRadixPart('Fallback');
export var Corner = getRadixPart('Corner');
export var Scrollbar = getRadixPart('Scrollbar');
export var Sub = getRadixPart('Sub');
export var SubTrigger = getRadixPart('SubTrigger');
export var SubContent = getRadixPart('SubContent');
export var RadioGroup = getRadixPart('RadioGroup');
export var RadioItem = getRadixPart('RadioItem');
export var CheckboxItem = getRadixPart('CheckboxItem');
export var Provider = getRadixPart('Provider');
` : '';

              const mockCode = `
// Mock for: ${pkgName}
// Exports: ${Array.from(packageImports).join(', ') || 'default only'}

// Safe placeholder component that renders nothing but doesn't crash
// CRITICAL: This must always be a valid React component to prevent error #130
const safePlaceholder = function SafePlaceholder(props) {
  if (typeof window !== 'undefined' && window.React && window.React.createElement) {
    return window.React.createElement('div', { 'data-mock': '${pkgName}', style: { display: 'none' } });
  }
  return null;
};

// Helper to safely get a value from mock, always returning a function for component-like exports
function safeGetExport(mock, name, expectComponent) {
  if (!mock) return safePlaceholder;
  var val = mock[name];

  // If undefined or null, return placeholder
  if (val === undefined || val === null) return safePlaceholder;

  // If we expect a component (capitalized name or use* hook), ensure it's a function
  if (expectComponent && typeof val !== 'function') {
    console.warn('[mock] Expected function for ' + name + ' but got ' + typeof val);
    return safePlaceholder;
  }

  return val;
}

// Check if a name looks like a component (capitalized) or hook (useXxx)
function looksLikeComponent(name) {
  if (!name || typeof name !== 'string') return false;
  return name[0] === name[0].toUpperCase() || name.startsWith('use');
}

const registeredMock = (typeof window !== 'undefined' && window.__SCENERY_MOCKS__) ? window.__SCENERY_MOCKS__['${pkgName}'] : null;

// Default export - ensure it's a valid component (function), not an object with only named exports
// CRITICAL: Never allow undefined/null - always fall back to safePlaceholder
var defaultExport;
if (registeredMock && typeof registeredMock.default === 'function') {
  defaultExport = registeredMock.default;
} else if (typeof registeredMock === 'function') {
  defaultExport = registeredMock;
} else {
  defaultExport = safePlaceholder;
}
export default defaultExport;

// Named exports (from import analysis) - use registered mock if available
// CRITICAL: Use safePlaceholder as fallback to prevent undefined component errors
// For component-like names, ensure we always return a function
${namedImportList.map(name => {
  // Determine if this looks like a component/hook that should be a function
  const isComponentLike = name[0] === name[0].toUpperCase() || name.startsWith('use');
  return `export var ${name} = safeGetExport(registeredMock, '${name}', ${isComponentLike});`;
}).join('\n')}
${radixParts}
`;
              return { contents: mockCode, loader: 'js' };
            });
          },
        },
      ],
    });

    const bundledCode = buildResult.outputFiles?.[0]?.text;
    if (!bundledCode) {
      return {
        success: false,
        error: 'Bundle produced no output',
      };
    }

    // Prepend the inline mocks and wrap in error handling
    // Also ensure __SCENERY_COMPONENT__ is set even if there's an error
    const rawBundle = `
// === SCENERY INLINE MOCKS ===
try {
${createInlineMocks()}
} catch (mockError) {
  console.error('[bundle] Mock setup error:', mockError);
}

// === BUNDLED COMPONENT ===
try {
${bundledCode}
} catch (bundleError) {
  console.error('[bundle] Component bundle error:', bundleError);
  // Ensure __SCENERY_COMPONENT__ is set to something (don't use React - it might not be loaded)
  if (!window.__SCENERY_COMPONENT__) {
    window.__SCENERY_COMPONENT__ = function ErrorFallback() {
      // Use React only if available, otherwise return a simple element
      if (typeof React !== 'undefined' && React.createElement) {
        return React.createElement('div', { style: { color: 'red', padding: '16px' } },
          'Bundle error: ' + (bundleError.message || bundleError));
      }
      return null;
    };
    window.__BUNDLE_ERROR__ = bundleError.message || String(bundleError);
  }
}
`;

    // CRITICAL: Escape </script> to prevent breaking HTML parser when injected into script tags
    // This must happen here (main app side) since playwright-worker might not have the fix yet
    const finalBundle = rawBundle.replace(/<\/script>/gi, '<\\/script>');

    return {
      success: true,
      bundledJs: finalBundle,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[browser-bundler] Error bundling ${componentName}:`, message);

    return {
      success: false,
      error: message,
    };
  }
}
