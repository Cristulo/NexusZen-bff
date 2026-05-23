import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Configure Redis-backed Rate Limiting to prevent DDoS and API abuse
 */
export async function rateLimiterMiddleware(fastify: FastifyInstance) {
  // Check if Redis is registered, log warning if falling back to in-memory
  if (!fastify.redis) {
    fastify.log.warn('Redis is not registered. Rate limiting will fall back to in-memory storage.');
  }

  await fastify.register(rateLimit, {
    max: 100, // Max 100 requests
    timeWindow: 60000, // 1 minute (in milliseconds)
    redis: fastify.redis, // Reuses Fastify's Redis client if registered
    skipOnError: true, // Fail-open: do not block users if Redis goes down temporarily
    keyGenerator: (request) => {
      // If user is authenticated via JWT (attached by auth middleware), rate limit by User ID,
      // otherwise fallback to client IP address.
      const userId = (request as any).user?.id;
      return userId ? `ratelimit:user:${userId}` : `ratelimit:ip:${request.ip}`;
    },
    errorResponseBuilder: (request, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `DDoS Protection: Rate limit exceeded. Please try again in ${context.after}.`,
        correlationId: request.correlationId,
      };
    },
  });
}
