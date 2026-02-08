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
const createIcon = (name) => {
  return function LucideIcon(props) {
    return React.createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: props.size || 24,
      height: props.size || 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: props.strokeWidth || 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: props.className,
      'data-icon': name.toLowerCase(),
    }, React.createElement('circle', { cx: 12, cy: 12, r: 10 }));
  };
};

const lucideReact = new Proxy({}, {
  get: (_, name) => createIcon(String(name))
});

// Framer Motion - passthrough wrapper
const motion = new Proxy({}, {
  get: (_, tag) => {
    return function MotionComponent(props) {
      const { children, ...rest } = props;
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
      return React.createElement(String(tag), htmlProps, children);
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

// Next.js components
const nextImage = function NextImage(props) {
  return React.createElement('img', {
    src: props.src,
    alt: props.alt || '',
    width: props.width,
    height: props.height,
    className: props.className,
    style: props.style,
  });
};

const nextLink = function NextLink(props) {
  return React.createElement('a', {
    href: props.href,
    className: props.className,
    style: props.style,
  }, props.children);
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
    const { children, asChild, ...rest } = props;
    return React.createElement('div', {
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
    if (typeof window !== 'undefined' && window.__FORM_CONTEXT__ && typeof React !== 'undefined') {
      try { return React.useContext(window.__FORM_CONTEXT__); } catch (e) {}
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
    if (typeof window !== 'undefined' && window.__QUERY_CONTEXT__ && typeof React !== 'undefined') {
      try { return React.useContext(window.__QUERY_CONTEXT__); } catch (e) {}
    }
    return { invalidateQueries: () => {}, refetchQueries: () => {}, getQueryData: () => null };
  },
  QueryClient: function() { return {}; },
  QueryClientProvider: ({ children }) => children,
};

// Auth mocks - uses shared __AUTH_CONTEXT__ if available
const authMock = {
  useAuth: () => {
    if (typeof window !== 'undefined' && window.__AUTH_CONTEXT__ && typeof React !== 'undefined') {
      try { return React.useContext(window.__AUTH_CONTEXT__); } catch (e) {}
    }
    return { user: { id: '1', email: 'demo@example.com', name: 'Demo User' }, isAuthenticated: true, isLoading: false };
  },
  useUser: () => ({ id: '1', email: 'demo@example.com', name: 'Demo User' }),
  useSession: () => ({ data: { user: { id: '1', email: 'demo@example.com', name: 'Demo User' } }, status: 'authenticated' }),
  useClerk: () => ({ user: { id: '1', email: 'demo@example.com' }, signOut: () => {} }),
  SignIn: () => React.createElement('div', { 'data-clerk': 'sign-in' }, 'Sign In'),
  SignUp: () => React.createElement('div', { 'data-clerk': 'sign-up' }, 'Sign Up'),
  UserButton: () => React.createElement('div', { 'data-clerk': 'user-button' }, 'User'),
  SignedIn: ({ children }) => children,
  SignedOut: ({ children }) => children,
};

// Toast mocks - uses shared __TOAST_CONTEXT__ if available
const toastMock = {
  useToast: () => {
    if (typeof window !== 'undefined' && window.__TOAST_CONTEXT__ && typeof React !== 'undefined') {
      try { return React.useContext(window.__TOAST_CONTEXT__); } catch (e) {}
    }
    return { toast: () => '1', toasts: [], dismiss: () => {} };
  },
  toast: () => '1',
};

// i18n mocks - uses shared __I18N_CONTEXT__ if available
const i18nMock = {
  useTranslation: () => {
    if (typeof window !== 'undefined' && window.__I18N_CONTEXT__ && typeof React !== 'undefined') {
      try {
        const ctx = React.useContext(window.__I18N_CONTEXT__);
        return { t: ctx.t || ((k) => k), i18n: ctx.i18n || { language: 'en' } };
      } catch (e) {}
    }
    return { t: (k) => k, i18n: { language: 'en', changeLanguage: () => {} } };
  },
  Trans: ({ children }) => children,
  I18nextProvider: ({ children }) => children,
};

// Recharts mock (charting library)
const rechartsComponent = ({ children, ...props }) =>
  React.createElement('div', { 'data-recharts': 'chart', ...props }, children);

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
const headlessUIComponent = ({ children, ...props }) =>
  React.createElement('div', { 'data-headlessui': 'component', ...props },
    typeof children === 'function' ? children({ open: true, selected: false }) : children);

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
  Fragment: React.Fragment,
};

// React Spring mock
const reactSpring = {
  useSpring: () => [{ opacity: 1 }, () => {}],
  useSprings: () => [[], () => {}],
  useTrail: () => [[], () => {}],
  useTransition: () => [],
  animated: new Proxy({}, {
    get: (_, tag) => (props) => React.createElement(String(tag), props)
  }),
  config: { default: {}, gentle: {}, stiff: {}, wobbly: {} },
};

// Sonner/toast mock
const sonner = {
  toast: () => {},
  Toaster: () => React.createElement('div', { 'data-sonner': 'toaster' }),
};

// React Hot Toast mock
const reactHotToast = {
  default: () => {},
  toast: () => {},
  Toaster: () => React.createElement('div', { 'data-hot-toast': 'toaster' }),
};

// Export mocks for use in bundle
window.__SCENERY_MOCKS__ = {
  ...(__mocks__),
  'lucide-react': lucideReact,
  'framer-motion': framerMotion,
  'next/image': { default: nextImage },
  'next/link': { default: nextLink },
  'next/navigation': {
    useRouter: () => {
      // Use shared router context if available
      if (typeof window !== 'undefined' && window.__ROUTER_CONTEXT__ && typeof React !== 'undefined') {
        try { return React.useContext(window.__ROUTER_CONTEXT__); } catch (e) {}
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
      if (typeof window !== 'undefined' && window.__ROUTER_CONTEXT__ && typeof React !== 'undefined') {
        try { return React.useContext(window.__ROUTER_CONTEXT__); } catch (e) {}
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
    Canvas: ({ children }) => React.createElement('div', { 'data-r3f': 'canvas' }, 'WebGL not supported in preview'),
    useFrame: () => {},
    useThree: () => ({ camera: {}, scene: {}, gl: {}, size: { width: 100, height: 100 } }),
    useLoader: () => null,
    extend: () => {},
  },
  '@react-three/drei': new Proxy({}, {
    get: (_, name) => (props) => React.createElement('div', { 'data-drei': String(name).toLowerCase() })
  }),

  // Remotion (video) - stub
  'remotion': {
    useCurrentFrame: () => 0,
    useVideoConfig: () => ({ width: 1920, height: 1080, fps: 30, durationInFrames: 300 }),
    Composition: () => null,
    Sequence: ({ children }) => children,
    AbsoluteFill: ({ children, ...props }) => React.createElement('div', { style: { position: 'absolute', inset: 0 }, ...props }, children),
    Audio: () => null,
    Video: () => null,
    Img: (props) => React.createElement('img', props),
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
    Form: ({ children }) => React.createElement('form', null, children),
    Field: (props) => React.createElement('input', props),
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
    Swiper: ({ children }) => React.createElement('div', { 'data-swiper': 'container' }, children),
    SwiperSlide: ({ children }) => React.createElement('div', { 'data-swiper': 'slide' }, children),
    useSwiper: () => ({ slidePrev: () => {}, slideNext: () => {}, slideTo: () => {} }),
  },

  // React Player
  'react-player': {
    default: () => React.createElement('div', { 'data-player': 'video' }, 'Video Player'),
  },

  // React PDF
  '@react-pdf/renderer': {
    Document: ({ children }) => children,
    Page: ({ children }) => children,
    View: ({ children }) => React.createElement('div', null, children),
    Text: ({ children }) => React.createElement('span', null, children),
    Image: (props) => React.createElement('img', props),
    StyleSheet: { create: (styles) => styles },
    PDFViewer: ({ children }) => children,
  },

  // React Markdown
  'react-markdown': {
    default: ({ children }) => React.createElement('div', { 'data-markdown': true }, children),
  },

  // Highlight.js / Prism
  'react-syntax-highlighter': {
    Prism: ({ children }) => React.createElement('pre', null, React.createElement('code', null, children)),
    Light: ({ children }) => React.createElement('pre', null, React.createElement('code', null, children)),
  },
  'react-syntax-highlighter/dist/esm/styles/prism': new Proxy({}, { get: () => ({}) }),
  'react-syntax-highlighter/dist/esm/styles/hljs': new Proxy({}, { get: () => ({}) }),
};

// next-themes mock for useTheme - uses global ThemeContext if available
const nextThemes = {
  useTheme: () => {
    // Try to use the global ThemeContext from html-template if available
    if (typeof window !== 'undefined' && window.__THEME_CONTEXT__ && typeof React !== 'undefined') {
      try {
        return React.useContext(window.__THEME_CONTEXT__);
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
              if (args.path === 'react' || args.path === 'react/jsx-runtime' || args.path === 'react/jsx-dev-runtime') {
                return {
                  contents: `
                    const React = window.React;
                    export default React;
                    export const {
                      createElement, createContext, createRef,
                      forwardRef, memo, lazy, Suspense, Fragment,
                      useState, useEffect, useContext, useReducer, useCallback,
                      useMemo, useRef, useImperativeHandle, useLayoutEffect,
                      useDebugValue, useId, useSyncExternalStore, useTransition,
                      useDeferredValue, Children, Component, PureComponent,
                      StrictMode, Profiler, cloneElement, isValidElement
                    } = React;
                    // JSX runtime exports
                    export const jsx = React.createElement;
                    export const jsxs = React.createElement;
                    export const jsxDEV = React.createElement;
                  `,
                  loader: 'js',
                };
              }
              if (args.path === 'react-dom' || args.path === 'react-dom/client') {
                return {
                  contents: `
                    const ReactDOM = window.ReactDOM;
                    export default ReactDOM;
                    export const { createRoot, hydrateRoot, createPortal, flushSync, render, hydrate } = ReactDOM;
                  `,
                  loader: 'js',
                };
              }
              // Fallback for any other react-related imports
              return { contents: 'export default window.React;', loader: 'js' };
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

              // Build export statements for exactly what's imported
              // These check the registered mock first (works with Proxy), then fall back to mockFn
              const namedExports = namedImportList
                .map(name => `export const ${name} = registeredMock ? (registeredMock['${name}'] ?? mockFn) : mockFn;`)
                .join('\n');

              // Check if this is a Radix UI package - needs common component part exports
              const isRadixPackage = pkgName.startsWith('@radix-ui/react-');

              // Common Radix component parts that need to be exported for namespace imports
              const radixParts = isRadixPackage ? `
// Radix component parts for namespace imports (import * as XPrimitive)
export const Root = registeredMock ? (registeredMock['Root'] ?? registeredMock) : mockFn;
export const Trigger = registeredMock ? (registeredMock['Trigger'] ?? registeredMock) : mockFn;
export const Content = registeredMock ? (registeredMock['Content'] ?? registeredMock) : mockFn;
export const Portal = registeredMock ? (registeredMock['Portal'] ?? registeredMock) : mockFn;
export const Overlay = registeredMock ? (registeredMock['Overlay'] ?? registeredMock) : mockFn;
export const Title = registeredMock ? (registeredMock['Title'] ?? registeredMock) : mockFn;
export const Description = registeredMock ? (registeredMock['Description'] ?? registeredMock) : mockFn;
export const Close = registeredMock ? (registeredMock['Close'] ?? registeredMock) : mockFn;
export const Action = registeredMock ? (registeredMock['Action'] ?? registeredMock) : mockFn;
export const Cancel = registeredMock ? (registeredMock['Cancel'] ?? registeredMock) : mockFn;
export const Item = registeredMock ? (registeredMock['Item'] ?? registeredMock) : mockFn;
export const ItemText = registeredMock ? (registeredMock['ItemText'] ?? registeredMock) : mockFn;
export const ItemIndicator = registeredMock ? (registeredMock['ItemIndicator'] ?? registeredMock) : mockFn;
export const Group = registeredMock ? (registeredMock['Group'] ?? registeredMock) : mockFn;
export const Label = registeredMock ? (registeredMock['Label'] ?? registeredMock) : mockFn;
export const Separator = registeredMock ? (registeredMock['Separator'] ?? registeredMock) : mockFn;
export const Arrow = registeredMock ? (registeredMock['Arrow'] ?? registeredMock) : mockFn;
export const Value = registeredMock ? (registeredMock['Value'] ?? registeredMock) : mockFn;
export const Icon = registeredMock ? (registeredMock['Icon'] ?? registeredMock) : mockFn;
export const Viewport = registeredMock ? (registeredMock['Viewport'] ?? registeredMock) : mockFn;
export const ScrollUpButton = registeredMock ? (registeredMock['ScrollUpButton'] ?? registeredMock) : mockFn;
export const ScrollDownButton = registeredMock ? (registeredMock['ScrollDownButton'] ?? registeredMock) : mockFn;
export const Track = registeredMock ? (registeredMock['Track'] ?? registeredMock) : mockFn;
export const Range = registeredMock ? (registeredMock['Range'] ?? registeredMock) : mockFn;
export const Thumb = registeredMock ? (registeredMock['Thumb'] ?? registeredMock) : mockFn;
export const Header = registeredMock ? (registeredMock['Header'] ?? registeredMock) : mockFn;
export const Body = registeredMock ? (registeredMock['Body'] ?? registeredMock) : mockFn;
export const Footer = registeredMock ? (registeredMock['Footer'] ?? registeredMock) : mockFn;
export const List = registeredMock ? (registeredMock['List'] ?? registeredMock) : mockFn;
export const Indicator = registeredMock ? (registeredMock['Indicator'] ?? registeredMock) : mockFn;
export const Image = registeredMock ? (registeredMock['Image'] ?? registeredMock) : mockFn;
export const Fallback = registeredMock ? (registeredMock['Fallback'] ?? registeredMock) : mockFn;
export const Corner = registeredMock ? (registeredMock['Corner'] ?? registeredMock) : mockFn;
export const Scrollbar = registeredMock ? (registeredMock['Scrollbar'] ?? registeredMock) : mockFn;
export const Sub = registeredMock ? (registeredMock['Sub'] ?? registeredMock) : mockFn;
export const SubTrigger = registeredMock ? (registeredMock['SubTrigger'] ?? registeredMock) : mockFn;
export const SubContent = registeredMock ? (registeredMock['SubContent'] ?? registeredMock) : mockFn;
export const RadioGroup = registeredMock ? (registeredMock['RadioGroup'] ?? registeredMock) : mockFn;
export const RadioItem = registeredMock ? (registeredMock['RadioItem'] ?? registeredMock) : mockFn;
export const CheckboxItem = registeredMock ? (registeredMock['CheckboxItem'] ?? registeredMock) : mockFn;
export const Provider = registeredMock ? (registeredMock['Provider'] ?? registeredMock) : mockFn;
` : '';

              const mockCode = `
// Mock for: ${pkgName}
// Exports: ${Array.from(packageImports).join(', ') || 'default only'}
const mockFn = function mockFunction() { return null; };

const registeredMock = (typeof window !== 'undefined' && window.__SCENERY_MOCKS__) ? window.__SCENERY_MOCKS__['${pkgName}'] : null;

// Default export
export default registeredMock?.default || registeredMock || mockFn;

// Named exports (from import analysis) - use registered mock if available
${namedExports}
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

    // Prepend the inline mocks
    const finalBundle = createInlineMocks() + '\n' + bundledCode;

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
