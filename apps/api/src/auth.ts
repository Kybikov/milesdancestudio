import type { FastifyInstance, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { db } from "./db.js";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  avatarPath: string | null;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

declare module "fastify" {
  interface FastifyRequest {
    sessionUser?: SessionUser;
  }
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requirePermission(
      code: string,
    ): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function getSessionUser(
  userId: string,
): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });
  if (!user?.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarPath: user.avatarPath,
    mustChangePassword: user.mustChangePassword,
    roles: user.roles.map(({ role }) => role.code),
    permissions: [
      ...new Set(
        user.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ],
  };
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate("authenticate", async (request, reply) => {
    try {
      await request.jwtVerify({ onlyCookie: true });
      const sessionUser = await getSessionUser(request.user.sub);
      if (!sessionUser)
        return reply.code(401).send({ message: "Потрібна авторизація" });
      request.sessionUser = sessionUser;
    } catch {
      return reply.code(401).send({ message: "Потрібна авторизація" });
    }
  });

  app.decorate(
    "requirePermission",
    (code: string) => async (request, reply) => {
      await app.authenticate(request, reply);
      if (reply.sent) return;
      if (!request.sessionUser?.permissions.includes(code)) {
        return reply.code(403).send({ message: "Недостатньо прав" });
      }
    },
  );
});
