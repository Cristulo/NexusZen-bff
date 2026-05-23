import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Register health check endpoints
 */
export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    let redisStatus = 'UNKNOWN';
    
    // Check Redis connection if the plugin is registered
    if (fastify.redis) {
      try {
        const ping = await fastify.redis.ping();
        redisStatus = ping === 'PONG' ? 'UP' : 'DOWN';
      } catch (err) {
        fastify.log.error({ err }, 'Redis health check failed');
        redisStatus = 'DOWN';
      }
    } else {
      redisStatus = 'NOT_CONFIGURED';
    }

    const isHealthy = redisStatus === 'UP' || redisStatus === 'NOT_CONFIGURED';
    
    reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      services: {
        gateway: 'UP',
        redis: redisStatus,
      },
      memory: process.memoryUsage(),
    });
  });
}
