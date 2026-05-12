import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";

import { readServerConfig } from "./config";
import type { ServerConfig } from "./config";
import { ChangelogController } from "./changelog/changelog-controller";
import {
  createAdminChangelogRouter,
  createChangelogRouter,
} from "./changelog/changelog-routes";
import { ChangelogRepository } from "./changelog/changelog-repository";
import { ChangelogService } from "./changelog/changelog-service";
import { createAuthRouter } from "./auth/auth-routes";
import { ContentRepository } from "./content/content-repository";
import { createContentRouter } from "./content/content-routes";
import { seedJsonResources } from "./content/content-seed";
import { openDatabase } from "./db/database";
import type { GrayvaleDatabase } from "./db/database";
import { DefinitionRepository } from "./definitions/definition-repository";
import { registerAdminDefinitionRoutes } from "./definitions/admin-definition-routes";
import { registerDefinitionAssetRoutes } from "./definitions/definition-asset-routes";
import { DefinitionAssetService } from "./definitions/definition-asset-service";
import { AdminDefinitionService } from "./definitions/admin-definition-service";
import { registerDefinitionRoutes } from "./definitions/definition-routes";
import { DefinitionService } from "./definitions/definition-service";
import { syncDefinitions } from "./definitions/definition-sync";
import { EntityRepository } from "./entities/entity-repository";
import { registerEntityRoutes } from "./entities/entity-routes";
import { seedApiEntities } from "./entities/entity-seed";
import { createMultiplayerRouter } from "./multiplayer/multiplayer-routes";
import { MultiplayerRepository } from "./multiplayer/multiplayer-repository";
import { createTagRegistryRouter } from "./tags/tag-registry";

let appPromise: Promise<Express> | null = null;
let configCache: ServerConfig | null = null;

export async function createApp(
  config: ServerConfig,
  db: GrayvaleDatabase,
): Promise<Express> {
  const app = express();
  const seededResources = await seedJsonResources(db, config.contentRoot);
  const seededEntities = await seedApiEntities(db, seededResources);
  const syncedDefinitions = await syncDefinitions(db, config.definitionRoot);
  const repository = new ContentRepository(db);
  const definitionRepository = new DefinitionRepository(db);
  const definitionService = new DefinitionService(
    definitionRepository,
    config.definitionRoot,
  );
  const definitionAssetService = new DefinitionAssetService(
    resolve(config.definitionRoot, "..", "..", "public", "assets", "definitions"),
  );
  const adminDefinitionService = new AdminDefinitionService(
    definitionRepository,
    definitionAssetService,
    config.definitionRoot,
    resolve(config.definitionRoot, "tag-registry.json"),
  );
  const entityRepository = new EntityRepository(db);
  const multiplayerRepository = new MultiplayerRepository(db);
  const changelogRepository = new ChangelogRepository(db);
  const changelogService = new ChangelogService(changelogRepository);
  const changelogController = new ChangelogController(
    changelogService,
    multiplayerRepository,
    config.adminPassword,
  );

  // Trust the first proxy hop so that req.ip and secure-cookie detection
  // work correctly on Vercel / behind a load-balancer.
  app.set("trust proxy", 1);

  // Security headers (helmet defaults: X-Frame-Options, X-Content-Type-Options,
  // HSTS, Referrer-Policy, etc.).
  // CSP and COEP are disabled: this server returns JSON only, never HTML, so
  // Content-Security-Policy has no effect and would add noise to every response.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Attach a unique correlation ID to every request so errors can be traced.
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId =
      typeof request.headers["x-request-id"] === "string"
        ? request.headers["x-request-id"]
        : randomUUID();
    request.headers["x-request-id"] = requestId;
    response.setHeader("X-Request-Id", requestId);
    next();
  });

  app.use(
    cors({
      // When allowedOrigins is populated use it as an explicit allowlist.
      // When empty (development default) reflect the request origin so that
      // local tooling and the dev server work without configuration.
      origin:
        config.allowedOrigins.length > 0
          ? (config.allowedOrigins as string[])
          : (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
              callback(null, true);
            },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
        name: config.name,
        status: "ok",
        seededResourceCount: seededResources.length,
        seededEntityCount: seededEntities.length,
        syncedDefinitionCount: syncedDefinitions.length,
      });
  });

  app.use("/api/data", createContentRouter(repository));
  app.use("/api/changelog", createChangelogRouter(changelogController));
  app.use("/api/admin", createAdminChangelogRouter(changelogController));
  app.use("/api/auth", createAuthRouter(multiplayerRepository));
  app.use(
    "/api/tags",
    createTagRegistryRouter(resolve(config.definitionRoot, "tag-registry.json")),
  );
  app.use(
    "/api/server",
    createMultiplayerRouter(multiplayerRepository, config),
  );
  registerDefinitionAssetRoutes(app, definitionAssetService);
  registerAdminDefinitionRoutes(
    app,
    adminDefinitionService,
    multiplayerRepository,
  );
  registerDefinitionRoutes(app, definitionService);
  registerEntityRoutes(app, "/api/attributes", "attribute", entityRepository);
  registerEntityRoutes(
    app,
    "/api/balance-profiles",
    "balance-profile",
    entityRepository,
  );
  registerEntityRoutes(
    app,
    "/api/dialogue-actors",
    "dialogue-actor",
    entityRepository,
  );
  registerEntityRoutes(app, "/api/dialogues", "dialogue", entityRepository);
  registerEntityRoutes(
    app,
    "/api/difficulty-curves",
    "difficulty-curve",
    entityRepository,
  );
  registerEntityRoutes(app, "/api/quests", "quest", entityRepository);
  registerEntityRoutes(app, "/api/skills", "skill", entityRepository);
  registerEntityRoutes(app, "/api/weapons", "weapon", entityRepository);
  registerEntityRoutes(
    app,
    "/api/world-guards",
    "world-guard",
    entityRepository,
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function resolveVercelApp(): Promise<Express> {
  if (appPromise) {
    return appPromise;
  }

  appPromise = (async () => {
    const config = resolveVercelConfig();
    const db = await openDatabase(config);

    return createApp(config, db);
  })();

  try {
    return await appPromise;
  } catch (error) {
    appPromise = null;
    throw error;
  }
}

function resolveVercelConfig(): ServerConfig {
  if (!configCache) {
    configCache = readServerConfig();
  }

  return configCache;
}

export default async function handler(
  request: Request,
  response: Response,
): Promise<void> {
  try {
    // Resolve config first (synchronous after first call) so we can apply
    // CORS headers even if the async app bootstrap hasn't completed yet.
    const config = resolveVercelConfig();
    applyCorsHeaders(request, response, config.allowedOrigins);

    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }

    const app = await resolveVercelApp();
    app(request, response);
  } catch (error) {
    if (response.headersSent) {
      return;
    }

    const message = isProductionRuntime()
      ? "An unexpected error occurred."
      : error instanceof Error
        ? error.message
        : "Server bootstrap failed.";

    response.status(500).json({
      error: "bootstrap_failed",
      message,
    });
  }
}

function applyCorsHeaders(
  request: Request,
  response: Response,
  allowedOrigins: readonly string[],
): void {
  const origin = request.headers.origin;

  if (typeof origin === "string" && origin.length > 0) {
    const isAllowed =
      allowedOrigins.length === 0 || allowedOrigins.includes(origin);

    if (isAllowed) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Vary", "Origin");
    }
  } else if (allowedOrigins.length === 0) {
    response.setHeader("Access-Control-Allow-Origin", "*");
  }

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
}

function notFoundHandler(_request: Request, response: Response): void {
  response.status(404).json({
    error: "not_found",
    message: "Route not found.",
  });
}

function isProductionRuntime(): boolean {
  return (
    process.env["NODE_ENV"] === "production" ||
    process.env["VERCEL"] !== undefined
  );
}

function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  // In production hide internal error details to prevent information leakage.
  // In development return the full message to aid debugging.
  const message = isProductionRuntime()
    ? "An unexpected error occurred."
    : error instanceof Error
      ? error.message
      : "Unexpected server error.";

  response.status(500).json({
    error: "internal_error",
    message,
  });
}
