export interface RenderOptions {
    bundledJs: string;
    componentName: string;
    props: Record<string, unknown>;
    timeout?: number;
}
export interface RenderResult {
    success: boolean;
    html?: string;
    error?: string;
    renderTime?: number;
}
/**
 * Initialize the browser instance
 */
export declare function initBrowser(): Promise<void>;
/**
 * Close the browser instance
 */
export declare function closeBrowser(): Promise<void>;
/**
 * Render a React component and extract its HTML
 */
export declare function renderComponent(options: RenderOptions): Promise<RenderResult>;
declare global {
    interface Window {
        __RENDER_COMPLETE__?: boolean;
        __RENDER_ERROR__?: {
            message: string;
            stack?: string;
        };
        __SCENERY_COMPONENT__?: React.ComponentType<any>;
    }
}
