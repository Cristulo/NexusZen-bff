import Fastify from 'fastify';
import fastifyRedis from '@fastify/redis';
import underPressure from '@fastify/under-pressure';
import { env } from './config/env.js';
import { correlationMiddleware } from './middleware/correlation.js';
import { rateLimiterMiddleware } from './middleware/rate-limiter.js';
import { authMiddleware } from './middleware/auth.js';
import { proxyRoutes } from './proxy/routes.js';
import { healthRoutes } from './monitor/health.js';
import { metricsMiddleware } from './monitor/metrics.js';

// 1. Initialize Fastify with environment-tailored logging
const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
  disableRequestLogging: env.NODE_ENV !== 'development', // Reduce log pollution in production
});

// 2. Install global unhandled exception catcher
fastify.setErrorHandler((error, request, reply) => {
  const correlationId = request.correlationId;

  fastify.log.error({ error, correlationId }, 'Unhandled Gateway Exception');

  // Fastify or middleware structured error (e.g. Rate Limit 429)
  if (error.statusCode) {
    reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.name,
      message: error.message,
      correlationId,
    });
    return;
  }

  // Internal unexpected server error
  reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'An unexpected gateway error occurred.',
    correlationId,
  });
});

async function bootstrap() {
  try {
    // 3. Register Correlation ID middleware first (so all other modules have access to the ID)
    await fastify.register(correlationMiddleware);

    // 4. Register Load Shedding (Under Pressure) protection
    await fastify.register(underPressure, {
      maxEventLoopDelay: 1000, // delay threshold in ms
      maxHeapUsedBytes: 500 * 1024 * 1024, // Reject requests if memory heap exceeds 500MB
      maxRssBytes: 1000 * 1024 * 1024, // Reject requests if RSS exceeds 1GB
      exposeStatusRoute: false, // Bypass default endpoint; we expose a rich /health check
      pressureHandler: (request, reply, type, value) => {
        fastify.log.warn(
          { type, value, correlationId: request.correlationId },
          'BFF Gateway is under critical resource pressure!',
        );

        reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Server is currently overloaded. Please try again shortly.',
          correlationId: request.correlationId,
        });
      },
    });

    // 5. Connect to Redis Client
    await fastify.register(fastifyRedis, {
      url: env.REDIS_URL,
      closeClient: true,
    });
    fastify.log.info(`Redis client connected to ${env.REDIS_URL.split('@').pop()}`);

    // 6. Register DDoS protection rate limiter
    await fastify.register(rateLimiterMiddleware);

    // 7. Register Prometheus metrics tracker (needs to hook response times before routing proxies)
    await fastify.register(metricsMiddleware);

    // 8. Register health diagnosis routes
    await fastify.register(healthRoutes);

    // 9. Register JWT Auth verification preHandler hooks
    await fastify.register(authMiddleware);

    // 10. Register reverse proxy gateways
    await fastify.register(proxyRoutes);

    // 11. Start Fastify Server
    await fastify.listen({ port: env.PORT, host: env.HOST });
    console.log(`\n🚀 NexusZen BFF / API Gateway running at http://${env.HOST}:${env.PORT}\n`);
  } catch (err) {
    fastify.log.fatal({ err }, 'Failed to bootstrap the API Gateway');
    process.exit(1);
  }
}

bootstrap();
