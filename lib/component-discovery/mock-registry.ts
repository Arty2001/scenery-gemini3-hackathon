/**
 * Mock registry for common React ecosystem packages.
 * Used during SSR preview rendering so that components importing
 * lucide-react, framer-motion, next/*, etc. don't crash.
 *
 * Strategy:
 * - Known packages get hand-crafted mocks that return valid JSX/values
 * - Unknown packages get a Proxy-based fallback that returns no-op functions/empty components
 */

import * as React from 'react';

// ---------------------------------------------------------------------------
// Helper: create a stub React component that renders its children (or nothing)
// ---------------------------------------------------------------------------
function stubComponent(displayName: string) {
  const Comp = ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('div', { 'data-mock': displayName, ...filterHtmlProps(props) }, children as React.ReactNode);
  Comp.displayName = `Mock(${displayName})`;
  return Comp;
}

/** Keep only simple string/number props safe for HTML attributes */
function filterHtmlProps(props: Record<string, unknown>) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === 'children') continue;
    if (typeof v === 'string' || typeof v === 'number') {
      // Convert camelCase React props to lowercase for HTML
      safe[k] = v;
    }
    if (k === 'className') safe[k] = v;
    if (k === 'style' && typeof v === 'object') safe[k] = v;
  }
  return safe;
}

// ---------------------------------------------------------------------------
// Lucide React: every named export is an icon component → render as <svg>
// ---------------------------------------------------------------------------
function lucideIcon(name: string) {
  const Icon = (props: Record<string, unknown>) =>
    React.createElement('svg', {
      width: (props.size as number) ?? 24,
      height: (props.size as number) ?? 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: (props.color as string) ?? 'currentColor',
      strokeWidth: (props.strokeWidth as number) ?? 2,
      className: props.className as string,
      'data-icon': name,
    });
  Icon.displayName = name;
  return Icon;
}

const lucideReactProxy = new Proxy(
  {} as Record<string, unknown>,
  { get: (_t, prop: string) => lucideIcon(prop) }
);

// ---------------------------------------------------------------------------
// Framer Motion: motion.div etc → plain HTML, AnimatePresence → passthrough
// ---------------------------------------------------------------------------
const motionProxy = new Proxy(
  {} as Record<string, unknown>,
  {
    get: (_t, tag: string) => {
      const Comp = ({ children, ...props }: Record<string, unknown>) =>
        React.createElement(tag, filterHtmlProps(props), children as React.ReactNode);
      Comp.displayName = `motion.${tag}`;
      return Comp;
    },
  }
);

const framerMotionMock = {
  motion: motionProxy,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useAnimation: () => ({}),
  useMotionValue: (v: number) => ({ get: () => v, set: () => {} }),
  useTransform: (v: unknown) => v,
  useSpring: (v: unknown) => v,
  useInView: () => false,
  useScroll: () => ({ scrollY: { get: () => 0, set: () => {} }, scrollYProgress: { get: () => 0, set: () => {} } }),
};

// ---------------------------------------------------------------------------
// Next.js modules
// ---------------------------------------------------------------------------
const nextImageMock = {
  default: (props: Record<string, unknown>) =>
    React.createElement('img', {
      src: props.src as string,
      alt: props.alt as string,
      width: props.width as number,
      height: props.height as number,
      className: props.className as string,
      style: props.style as React.CSSProperties,
    }),
  __esModule: true,
};

const nextLinkMock = {
  default: ({ children, href, className }: Record<string, unknown>) =>
    React.createElement('a', { href: href as string, className: className as string }, children as React.ReactNode),
  __esModule: true,
};

const nextRouterMock = {
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    pathname: '/',
    query: {},
    asPath: '/',
    route: '/',
    events: { on: () => {}, off: () => {}, emit: () => {} },
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
};

const nextNavigationMock = { ...nextRouterMock };

// ---------------------------------------------------------------------------
// Utility libraries
// ---------------------------------------------------------------------------
const clsxMock = {
  default: (...args: unknown[]) => args.flat().filter(Boolean).join(' '),
  clsx: (...args: unknown[]) => args.flat().filter(Boolean).join(' '),
  __esModule: true,
};

const cvaMock = {
  cva: (base: string) => () => base,
  default: (base: string) => () => base,
  __esModule: true,
};

const twMergeMock = {
  twMerge: (...args: unknown[]) => args.flat().filter(Boolean).join(' '),
  cn: (...args: unknown[]) => args.flat().filter(Boolean).join(' '),
  default: (...args: unknown[]) => args.flat().filter(Boolean).join(' '),
  __esModule: true,
};

const classVarianceAuthorityMock = { ...cvaMock };

// ---------------------------------------------------------------------------
// date-fns: return placeholder strings
// ---------------------------------------------------------------------------
const dateFnsMock = new Proxy(
  {} as Record<string, unknown>,
  {
    get: (_t, prop: string) => {
      if (prop === '__esModule') return true;
      // Every export is a function that returns a string
      return (..._args: unknown[]) => '—';
    },
  }
);

// ---------------------------------------------------------------------------
// Radix UI: all exports are passthrough components
// ---------------------------------------------------------------------------
function radixMock() {
  return new Proxy(
    {} as Record<string, unknown>,
    {
      get: (_t, prop: string) => {
        if (prop === '__esModule') return true;
        return stubComponent(`Radix.${prop}`);
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Proxy-based fallback for unknown packages
// ---------------------------------------------------------------------------
function unknownPackageMock(packageName: string) {
  return new Proxy(
    {} as Record<string, unknown>,
    {
      get: (_t, prop: string) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return stubComponent(`${packageName}.default`);
        // Check if it looks like a component name (PascalCase)
        if (/^[A-Z]/.test(prop)) return stubComponent(`${packageName}.${prop}`);
        // Check if it looks like a hook
        if (/^use[A-Z]/.test(prop)) return () => undefined;
        // Otherwise return a no-op function
        return () => undefined;
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Main registry: maps package name → mock module
// ---------------------------------------------------------------------------
const MOCK_REGISTRY: Record<string, unknown> = {
  'lucide-react': lucideReactProxy,
  'framer-motion': framerMotionMock,
  'next/image': nextImageMock,
  'next/link': nextLinkMock,
  'next/router': nextRouterMock,
  'next/navigation': nextNavigationMock,
  'clsx': clsxMock,
  'clsx/lite': clsxMock,
  'cva': cvaMock,
  'class-variance-authority': classVarianceAuthorityMock,
  'tailwind-merge': twMergeMock,
  'date-fns': dateFnsMock,
  'date-fns/locale': dateFnsMock,
};

// Patterns that get special treatment
const PATTERN_MOCKS: Array<[RegExp, (name: string) => unknown]> = [
  [/^@radix-ui\//, radixMock],
  [/^next\//, (name) => unknownPackageMock(name)],
  [/^@heroicons\//, () => lucideReactProxy], // Similar icon library
  [/^react-icons\//, () => lucideReactProxy],
];

/**
 * Get a mock module for a given package name.
 * Returns the mock or null if no mock is available (will use Proxy fallback).
 */
export function getMock(packageName: string): unknown {
  // Exact match
  if (MOCK_REGISTRY[packageName]) {
    return MOCK_REGISTRY[packageName];
  }

  // Pattern match
  for (const [pattern, factory] of PATTERN_MOCKS) {
    if (pattern.test(packageName)) {
      return factory(packageName);
    }
  }

  // Fallback: Proxy-based mock for any unknown package
  return unknownPackageMock(packageName);
}

/**
 * Create a custom require function that intercepts external imports
 * and returns mocks instead of failing.
 */
export function createMockRequire(realRequire: NodeRequire): NodeRequire {
  const mockRequire = ((id: string) => {
    // Let react/react-dom through to real require
    if (id === 'react' || id === 'react-dom' || id === 'react-dom/server' || id === 'react/jsx-runtime') {
      return realRequire(id);
    }
    // Everything else gets mocked
    return getMock(id);
  }) as NodeRequire;

  // Copy over require properties
  mockRequire.resolve = realRequire.resolve;
  mockRequire.cache = realRequire.cache;
  mockRequire.extensions = realRequire.extensions;
  mockRequire.main = realRequire.main;
  return mockRequire;
}
