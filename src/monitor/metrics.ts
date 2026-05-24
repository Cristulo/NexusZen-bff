import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import client from 'prom-client';

// Enable default metrics collection (CPU, Memory, GC, Event Loop Lag)
client.collectDefaultMetrics({ register: client.register });

// 📊 Custom HTTP Counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed by the API Gateway',
  labelNames: ['method', 'route', 'status_code'],
});

// ⏱️ Custom HTTP Latency Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Seconds buckets
});

/**
 * Middleware/Plugin to collect Prometheus metrics and expose /metrics
 */
export async function metricsMiddleware(fastify: FastifyInstance) {
  // Hook to record metrics upon finishing responses
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Determine the route pattern or fall back to 'unmatched'
    const route = request.routeConfig?.url || 'unmatched';
    const method = request.method;
    const statusCode = reply.statusCode.toString();

    // Fastify automatically records response time in ms
    const durationMs = reply.getResponseTime();

    // Increment request count and record duration in seconds
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe(
      { method, route, status_code: statusCode },
      durationMs / 1000,
    );
  });

  // Expose the metrics endpoint for Prometheus scraping
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Content-Type', client.register.contentType);
    return client.register.metrics();
  });
}
export { client };
