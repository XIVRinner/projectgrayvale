import type { Request, Response } from "express";
import { z } from "zod";

const sessionIdSchema = z.string().uuid();
export const SESSION_COOKIE_NAME = "grayvale_session";

export function extractSessionId(request: Request): string | undefined {
  return (
    optionalSessionId(request.body?.sessionId) ??
    optionalSessionId(request.query["sessionId"]) ??
    optionalSessionId(readCookie(request, SESSION_COOKIE_NAME))
  );
}

export function clearSessionCookie(response: Response, request: Request): void {
  const secure = isSecureRequest(request);

  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: secure ? "none" : "lax",
    secure,
    path: "/"
  });
}

function optionalSessionId(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }

  const parsed = sessionIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function readCookie(request: Request, key: string): string | undefined {
  const rawCookieHeader = request.headers["cookie"];

  if (typeof rawCookieHeader !== "string" || rawCookieHeader.trim().length === 0) {
    return undefined;
  }

  for (const segment of rawCookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = segment.split("=");
    const name = rawName?.trim();

    if (name !== key) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();

    if (!rawValue) {
      return undefined;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return undefined;
}

function isSecureRequest(request: Request): boolean {
  if (request.secure) {
    return true;
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  return typeof forwardedProto === "string" && forwardedProto.includes("https");
}
