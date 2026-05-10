import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";

import { readServerConfig } from "./config";
import type { ServerConfig } from "./config";
import { ContentRepository } from "./content/content-repository";
import { createContentRouter } from "./content/content-routes";
import { seedJsonResources } from "./content/content-seed";
import { openDatabase } from "./db/database";
import type { GrayvaleDatabase } from "./db/database";
import { EntityRepository } from "./entities/entity-repository";
import { registerEntityRoutes } from "./entities/entity-routes";
import { seedApiEntities } from "./entities/entity-seed";
import { createMultiplayerRouter } from "./multiplayer/multiplayer-routes";
import { MultiplayerRepository } from "./multiplayer/multiplayer-repository";

let appPromise: Promise<Express> | null = null;

export async function createApp(
  config: ServerConfig,
  db: GrayvaleDatabase,
): Promise<Express> {
  const app = express();
  const seededResources = await seedJsonResources(db, config.contentRoot);
  const seededEntities = await seedApiEntities(db, seededResources);
  const repository = new ContentRepository(db);
  const entityRepository = new EntityRepository(db);
  const multiplayerRepository = new MultiplayerRepository(db);

  app.use(
    cors({
      origin: true,
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
    });
  });

  app.use("/api/data", createContentRouter(repository));
  app.use(
    "/api/server",
    createMultiplayerRouter(multiplayerRepository, config),
  );
  registerEntityRoutes(app, "/api/activities", "activity", entityRepository);
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
  registerEntityRoutes(
    app,
    "/api/equipment-items",
    "equipment-item",
    entityRepository,
  );
  registerEntityRoutes(app, "/api/items", "item", entityRepository);
  registerEntityRoutes(app, "/api/quests", "quest", entityRepository);
  registerEntityRoutes(app, "/api/skills", "skill", entityRepository);
  registerEntityRoutes(app, "/api/weapons", "weapon", entityRepository);
  registerEntityRoutes(
    app,
    "/api/world-default-state",
    "world-default-state",
    entityRepository,
  );
  registerEntityRoutes(
    app,
    "/api/world-guards",
    "world-guard",
    entityRepository,
  );
  registerEntityRoutes(
    app,
    "/api/world-locations",
    "world-location",
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
    const config = readServerConfig();
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

export default async function handler(
  request: Request,
  response: Response,
): Promise<void> {
  applyCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    const app = await resolveVercelApp();
    app(request, response);
  } catch (error) {
    if (response.headersSent) {
      return;
    }

    const message =
      error instanceof Error ? error.message : "Server bootstrap failed.";

    response.status(500).json({
      error: "bootstrap_failed",
      message,
    });
  }
}

function applyCorsHeaders(request: Request, response: Response): void {
  const origin = request.headers.origin;

  if (typeof origin === "string" && origin.length > 0) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  } else {
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

function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  const message =
    error instanceof Error ? error.message : "Unexpected server error.";

  response.status(500).json({
    error: "internal_error",
    message,
  });
}
