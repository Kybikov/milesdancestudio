import type { FastifyRequest } from "fastify";
import { db } from "./db.js";

const forbiddenKeys = /password|token|secret|cookie|authorization/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !forbiddenKeys.test(key))
        .map(([key, child]) => [key, sanitize(child)]),
    );
  }
  return value;
}

export async function audit(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: unknown,
) {
  await db.auditLog.create({
    data: {
      actorId: request.sessionUser?.id,
      action,
      entityType,
      entityId,
      metadata: metadata ? (sanitize(metadata) as object) : undefined,
      ip: request.ip,
    },
  });
}
