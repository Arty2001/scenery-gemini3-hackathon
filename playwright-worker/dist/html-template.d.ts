/**
 * HTML template for rendering React components in Playwright
 *
 * Includes:
 * - React 18 from CDN (React 19 doesn't have UMD builds)
 * - Tailwind CSS for styling
 * - Base styles for component rendering
 */
export declare function createHtmlTemplate(options: {
    bundledJs: string;
    componentName: string;
    props: Record<string, unknown>;
}): string;
