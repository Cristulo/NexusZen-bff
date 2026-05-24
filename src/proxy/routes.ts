import { FastifyInstance, FastifyRequest } from 'fastify';
import httpProxy from '@fastify/http-proxy';
import { env } from '../config/env.js';

/**
 * Configure high-performance Reverse Proxy endpoints to downstream microservices
 */
export async function proxyRoutes(fastify: FastifyInstance) {
  // Helper to compile internal communication headers
  const getInternalHeaders = (
    request: FastifyRequest,
    incomingHeaders: Record<string, string | string[] | undefined>,
  ) => {
    const headers: Record<string, string> = {};

    // Copy original header keys safely (avoiding array type warnings)
    Object.keys(incomingHeaders).forEach((key) => {
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

    // 3. Propagate OAuth / Proxy headers
    if (request.headers['x-forwarded-host'])
      headers['x-forwarded-host'] = request.headers['x-forwarded-host'] as string;
    else headers['x-forwarded-host'] = request.hostname;

    if (request.headers['x-forwarded-proto'])
      headers['x-forwarded-proto'] = request.headers['x-forwarded-proto'] as string;
    else headers['x-forwarded-proto'] = request.protocol;

    if (request.headers['x-forwarded-for'])
      headers['x-forwarded-for'] = request.headers['x-forwarded-for'] as string;
    else headers['x-forwarded-for'] = request.ip;

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
      rewriteRequestHeaders: (request, headers) =>
        getInternalHeaders(request as FastifyRequest, headers),
    },
  });

  // 2. Enroute to Faculty Service (apijava-facultad, Port 5051)
  fastify.register(httpProxy, {
    upstream: env.FACULTAD_SERVICE_URL,
    prefix: '/api/v1/facultad',
    rewritePrefix: '/api',
    undici: {
      bodyTimeout: 5000,
      headersTimeout: 5000,
    },
    replyOptions: {
      rewriteRequestHeaders: (request, headers) =>
        getInternalHeaders(request as FastifyRequest, headers),
    },
  });

  // 3. Proxy OAuth2 Initiation (Spring Security standard path)
  fastify.register(httpProxy, {
    upstream: env.AUTH_SERVICE_URL,
    prefix: '/oauth2',
    rewritePrefix: '/oauth2',
    replyOptions: {
      rewriteRequestHeaders: (request, headers) =>
        getInternalHeaders(request as FastifyRequest, headers),
    },
  });

  // 4. Proxy OAuth2 Callbacks (Spring Security standard path)
  fastify.register(httpProxy, {
    upstream: env.AUTH_SERVICE_URL,
    prefix: '/login/oauth2',
    rewritePrefix: '/login/oauth2',
    replyOptions: {
      rewriteRequestHeaders: (request, headers) =>
        getInternalHeaders(request as FastifyRequest, headers),
    },
  });

  fastify.log.info(
    { authService: env.AUTH_SERVICE_URL, facultadService: env.FACULTAD_SERVICE_URL },
    'Reverse proxies successfully configured with 5000ms timeouts',
  );
}
