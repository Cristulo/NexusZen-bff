import { FastifyInstance, FastifyRequest } from 'fastify';
import httpProxy from '@fastify/http-proxy';
import { env } from '../config/env.js';

/**
 * Configure high-performance Reverse Proxy endpoints to downstream microservices
 */
export async function proxyRoutes(fastify: FastifyInstance) {
  
  // Helper to compile internal communication headers
  const getInternalHeaders = (request: FastifyRequest, incomingHeaders: any) => {
    const headers: Record<string, string> = {};

    // Copy original header keys safely (avoiding array type warnings)
    Object.keys(incomingHeaders).forEach(key => {
      const val = incomingHeaders[key];
      if (val !== undefined) {
        headers[key] = Array.isArray(val) ? val.join(', ') : String(val);
      }
    });

    // 1. Inject distributed tracing ID
    headers['X-Correlation-ID'] = request.correlationId || '';

    // 2. Propagate validated User Context (Token Relay Pattern)
    if (request.user) {
      headers['X-User-Id'] = request.user.id;
      headers['X-User-Roles'] = request.user.roles.join(',');
    }

    return headers;
  };

  // 1. Enroute to Authentication Service (apijava-auth, Port 5050)
  fastify.register(httpProxy, {
    upstream: env.AUTH_SERVICE_URL,
    prefix: '/api/v1/auth',
    rewritePrefix: '/api/v1/auth',
    undici: {
      bodyTimeout: 5000,
      headersTimeout: 5000,
    },
    replyOptions: {
      rewriteRequestHeaders: (request, headers) => getInternalHeaders(request as FastifyRequest, headers),
    },
  });

  // 2. Enroute to Faculty Service (apijava-facultad, Port 5051)
  fastify.register(httpProxy, {
    upstream: env.FACULTAD_SERVICE_URL,
    prefix: '/api/v1/facultad',
    rewritePrefix: '/api/v1/facultad',
    undici: {
      bodyTimeout: 5000,
      headersTimeout: 5000,
    },
    replyOptions: {
      rewriteRequestHeaders: (request, headers) => getInternalHeaders(request as FastifyRequest, headers),
    },
  });

  fastify.log.info(
    { authService: env.AUTH_SERVICE_URL, facultadService: env.FACULTAD_SERVICE_URL },
    'Reverse proxies successfully configured with 5000ms timeouts'
  );
}
