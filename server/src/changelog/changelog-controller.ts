import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

import type { MultiplayerRepository } from "../multiplayer/multiplayer-repository";
import { resolveChangelogActorContext } from "./changelog-auth";
import {
  parseChangelogListQuery,
  parseCreateEntryBody,
  parseCreateReleaseBody,
  parseEntryIdParam,
  parseMarkReadBody,
  parseReleaseIdParam,
  parseUnreadCountQuery,
  parseUpdateEntryBody,
  parseUpdateReleaseBody,
} from "./changelog-validation";
import {
  ChangelogService,
  ChangelogServiceError,
} from "./changelog-service";

export class ChangelogController {
  constructor(
    private readonly service: ChangelogService,
    private readonly multiplayerRepository: MultiplayerRepository,
    private readonly adminPassword: string,
  ) {}

  readonly list = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const query = parseChangelogListQuery(request.query);
      const changelog = await this.service.listPublishedReleases(query, {
        userId: actor.userId,
        clientId: actor.userId ? undefined : query.clientId,
        canViewInternal: actor.canViewInternal,
      });

      response.json(changelog);
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly latest = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const query = parseChangelogListQuery(request.query, 1);
      const changelog = await this.service.latestPublishedReleases(query, {
        userId: actor.userId,
        clientId: actor.userId ? undefined : query.clientId,
        canViewInternal: actor.canViewInternal,
      });

      response.json(changelog);
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly unreadCount = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const query = parseUnreadCountQuery(request.query);
      const count = await this.service.countUnreadPublishedReleases({
        userId: actor.userId,
        clientId: actor.userId ? undefined : query.clientId,
      });

      response.json({ count });
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly markRead = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const input = parseMarkReadBody(request.body);
      await this.service.markReleaseRead(input, {
        userId: actor.userId,
      });

      response.json({
        ok: true,
        releaseId: input.releaseId,
      });
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly createRelease = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const release = await this.service.createRelease(
        parseCreateReleaseBody(request.body),
        {
          userId: actor.userId,
          canViewInternal: actor.canViewInternal,
          isAdmin: actor.isAdmin,
        },
      );

      response.status(201).json({ release });
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly updateRelease = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const release = await this.service.updateRelease(
        parseReleaseIdParam(request.params["id"]),
        parseUpdateReleaseBody(request.body),
        {
          userId: actor.userId,
          canViewInternal: actor.canViewInternal,
          isAdmin: actor.isAdmin,
        },
      );

      response.json({ release });
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly deleteRelease = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      await this.service.deleteRelease(parseReleaseIdParam(request.params["id"]), {
        userId: actor.userId,
        canViewInternal: actor.canViewInternal,
        isAdmin: actor.isAdmin,
      });

      response.status(204).end();
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly createEntry = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const entry = await this.service.createEntry(
        parseReleaseIdParam(request.params["id"]),
        parseCreateEntryBody(request.body),
        {
          userId: actor.userId,
          canViewInternal: actor.canViewInternal,
          isAdmin: actor.isAdmin,
        },
      );

      response.status(201).json({ entry });
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly updateEntry = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const entry = await this.service.updateEntry(
        parseEntryIdParam(request.params["id"]),
        parseUpdateEntryBody(request.body),
        {
          userId: actor.userId,
          canViewInternal: actor.canViewInternal,
          isAdmin: actor.isAdmin,
        },
      );

      response.json({ entry });
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly deleteEntry = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      await this.service.deleteEntry(parseEntryIdParam(request.params["id"]), {
        userId: actor.userId,
        canViewInternal: actor.canViewInternal,
        isAdmin: actor.isAdmin,
      });

      response.status(204).end();
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  readonly publishRelease = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actor = await this.resolveActor(request);
      const release = await this.service.publishRelease(
        parseReleaseIdParam(request.params["id"]),
        {
          userId: actor.userId,
          canViewInternal: actor.canViewInternal,
          isAdmin: actor.isAdmin,
        },
      );

      response.json({ release });
    } catch (error) {
      this.handleError(error, response, next);
    }
  };

  private async resolveActor(request: Request) {
    return resolveChangelogActorContext(
      request,
      this.multiplayerRepository,
      this.adminPassword,
    );
  }

  private handleError(
    error: unknown,
    response: Response,
    next: NextFunction,
  ): void {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: "bad_request",
        message: error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }

    if (error instanceof ChangelogServiceError) {
      response.status(error.status).json({
        error: error.code,
        message: error.message,
      });
      return;
    }

    next(error);
  }
}
