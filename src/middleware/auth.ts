import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      roles: string[];
      activeRole?: string;
    };
  }
}

/**
 * Perimeter Authentication Middleware using JWT signature verification
 */
async function authMiddlewarePlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Define public paths bypass rules
    const publicRoutes = [
      '/health',
      '/metrics',
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/public',
      '/oauth2',
      '/login/oauth2',
    ];
    const path = request.url;

    if (publicRoutes.some((route) => path.startsWith(route))) {
      return; // Public route, bypass check
    }

    // 2. Extract authorization header
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
        correlationId: request.correlationId,
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // 3. Verify signature and expiration
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        id?: string;
        sub?: string;
        roles?: string[];
        role?: string;
        iat?: number;
      };

      // Extract subject/ID and roles flexibly
      const userId = decoded.id || decoded.sub;
      const roles = decoded.roles || (decoded.role ? [decoded.role] : []);

      if (!userId) {
        throw new Error('Invalid JWT payload: missing sub/id identifier');
      }

      // Check session revocation in Redis
      if (fastify.redis) {
        const revocationTimestamp = await fastify.redis.get(`user_revocation:${userId}`);
        if (revocationTimestamp && decoded.iat) {
          if (decoded.iat * 1000 < Number(revocationTimestamp)) {
            throw new Error('Token revoked by global logout');
          }
        }
      }

      // Extract and validate selected role
      const selectedRoleHeader = request.headers['x-selected-role'];
      let activeRole: string | undefined;

      if (selectedRoleHeader) {
        const requestedRole = Array.isArray(selectedRoleHeader)
          ? selectedRoleHeader[0]
          : selectedRoleHeader;
        if (roles.includes(requestedRole)) {
          activeRole = requestedRole;
        }
      }

      if (!activeRole && roles.length > 0) {
        activeRole = roles.includes('ROLE_USER') ? 'ROLE_USER' : roles[0];
      }

      // Attach credentials to request scope
      request.user = {
        id: userId,
        roles: roles,
        activeRole: activeRole,
      };

      request.log.info(
        { userId, activeRole, correlationId: request.correlationId },
        'User successfully authenticated at perimeter with active role',
      );
    } catch (err) {
      request.log.warn(
        { err, correlationId: request.correlationId },
        'Token signature verification failed',
      );

      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access token is invalid or has expired.',
        correlationId: request.correlationId,
      });
    }
  });
}

export const authMiddleware = fp(authMiddlewarePlugin);
