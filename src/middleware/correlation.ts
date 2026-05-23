import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

/**
 * Middleware/Plugin to inject and propagate X-Correlation-ID headers
 */
export async function correlationMiddleware(fastify: FastifyInstance) {
  fastify.decorateRequest('correlationId', '');

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const headerValue = request.headers['x-correlation-id'] || request.headers['X-Correlation-ID'];
    const correlationId = (Array.isArray(headerValue) ? headerValue[0] : headerValue) || randomUUID();
    
    // Attach to the request object for logger access
    request.correlationId = correlationId;
    
    // Inject the header in the response
    reply.header('X-Correlation-ID', correlationId);
  });
}
