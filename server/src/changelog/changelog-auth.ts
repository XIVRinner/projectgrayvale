import { createHash, timingSafeEqual } from "node:crypto";

import type { Request } from "express";
import { z } from "zod";

import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";
import type { PlayerRank } from "../multiplayer/multiplayer-types";

const sessionIdSchema = z.string().uuid();
const SESSION_COOKIE_NAME = "grayvale_session";

export interface ChangelogActorContext {
  readonly userId?: string;
  readonly rank?: PlayerRank;
  readonly isAdmin: boolean;
  readonly canViewInternal: boolean;
}

export async function resolveChangelogActorContext(
  request: Request,
  repository: MultiplayerRepository,
  adminPassword: string,
): Promise<ChangelogActorContext> {
  const sessionId = resolveOptionalSessionId(request);
  const adminHeader = readAdminPasswordHeader(request);
  const headerAdmin = adminHeader
    ? safePasswordCompare(adminHeader, adminPassword)
    : false;

  if (!sessionId) {
    return {
      isAdmin: headerAdmin,
      canViewInternal: headerAdmin,
    };
  }

  const session = await repository.getSession(sessionId);

  if (!session) {
    return {
      isAdmin: headerAdmin,
      canViewInternal: headerAdmin,
    };
  }

  const player = await repository.getAllowedPlayer(session.profileId);

  if (!player) {
    return {
      isAdmin: headerAdmin,
      canViewInternal: headerAdmin,
    };
  }

  const isAdmin = headerAdmin || player.rank === "admin";

  return {
    userId: player.profileId,
    rank: player.rank,
    isAdmin,
    canViewInternal: isAdmin,
  };
}

function readAdminPasswordHeader(request: Request): string | undefined {
  const header = request.headers["x-grayvale-admin-password"];

  return typeof header === "string" && header.trim().length > 0
    ? header.trim()
    : undefined;
}

function resolveOptionalSessionId(request: Request): string | undefined {
  return (
    parseOptionalSessionId(request.body?.sessionId) ??
    parseOptionalSessionId(request.query["sessionId"]) ??
    parseOptionalSessionId(readCookie(request, SESSION_COOKIE_NAME))
  );
}

function parseOptionalSessionId(raw: unknown): string | undefined {
  if (Array.isArray(raw)) {
    return parseOptionalSessionId(raw[0]);
  }

  if (typeof raw !== "string") {
    return undefined;
  }

  const parsed = sessionIdSchema.safeParse(raw.trim());
  return parsed.success ? parsed.data : undefined;
}

function readCookie(request: Request, key: string): string | undefined {
  const rawCookieHeader = request.headers["cookie"];

  if (
    typeof rawCookieHeader !== "string" ||
    rawCookieHeader.trim().length === 0
  ) {
    return undefined;
  }

  for (const segment of rawCookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = segment.split("=");

    if (rawName?.trim() !== key) {
      continue;
    }

    const value = rawValueParts.join("=").trim();

    if (!value) {
      return undefined;
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

function safePasswordCompare(left: string, right: string): boolean {
  const leftBuffer = createHash("sha256").update(left).digest();
  const rightBuffer = createHash("sha256").update(right).digest();

  return timingSafeEqual(leftBuffer, rightBuffer);
}
