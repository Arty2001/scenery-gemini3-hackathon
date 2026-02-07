import Fastify from 'fastify';
import cors from '@fastify/cors';
import { renderComponent, initBrowser, closeBrowser } from './renderer.js';
const fastify = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB limit for bundled JS
});
// Enable CORS
await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST'],
});
// Authentication middleware
const WORKER_SECRET = process.env.WORKER_SECRET;
fastify.addHook('onRequest', async (request, reply) => {
    // Skip auth for health check
    if (request.url === '/health')
        return;
    if (WORKER_SECRET) {
        const authHeader = request.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${WORKER_SECRET}`) {
            reply.code(401).send({ error: 'Unauthorized' });
            return;
        }
    }
});
// Health check endpoint
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});
// Main render endpoint
fastify.post('/render', async (request, reply) => {
    const { bundledJs, componentName, props = {}, timeout = 15000 } = request.body;
    // Validate required fields
    if (!bundledJs || typeof bundledJs !== 'string') {
        reply.code(400).send({ success: false, error: 'bundledJs is required and must be a string' });
        return;
    }
    if (!componentName || typeof componentName !== 'string') {
        reply.code(400).send({ success: false, error: 'componentName is required and must be a string' });
        return;
    }
    // Validate timeout
    const validTimeout = Math.min(Math.max(timeout, 1000), 60000); // 1s - 60s
    console.log(`[server] Rendering component: ${componentName} (timeout: ${validTimeout}ms)`);
    try {
        const result = await renderComponent({
            bundledJs,
            componentName,
            props,
            timeout: validTimeout,
        });
        console.log(`[server] Render complete: ${componentName} (success: ${result.success}, time: ${result.renderTime}ms)`);
        return result;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[server] Render failed: ${componentName}`, errorMessage);
        return {
            success: false,
            error: errorMessage,
        };
    }
});
// Graceful shutdown
const shutdown = async () => {
    console.log('[server] Shutting down...');
    await closeBrowser();
    await fastify.close();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Start server
const start = async () => {
    try {
        // Initialize browser on startup for faster first request
        await initBrowser();
        const port = parseInt(process.env.PORT || '3001', 10);
        const host = process.env.HOST || '0.0.0.0';
        await fastify.listen({ port, host });
        console.log(`[server] Playwright worker listening on ${host}:${port}`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=server.js.map