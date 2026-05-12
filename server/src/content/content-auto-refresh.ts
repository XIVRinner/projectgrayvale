import { watch, type FSWatcher } from "node:fs";

import type { GrayvaleDatabase } from "../db/database";
import { seedApiEntities } from "../entities/entity-seed";
import { seedJsonResources } from "./content-seed";

interface AutoRefreshOptions {
  readonly db: GrayvaleDatabase;
  readonly contentRoot: string;
  readonly debounceMs?: number;
  readonly logger?: (message: string) => void;
}

interface AutoRefreshHandle {
  stop: () => void;
}

export function startContentAutoRefresh(
  options: AutoRefreshOptions,
): AutoRefreshHandle {
  const debounceMs = options.debounceMs ?? 300;
  const log = options.logger ?? (() => undefined);
  let watcher: FSWatcher | null = null;
  let refreshTimer: NodeJS.Timeout | null = null;
  let refreshInFlight = false;
  let refreshQueued = false;

  const refresh = async (reason: string): Promise<void> => {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }

    refreshInFlight = true;

    try {
      const resources = await seedJsonResources(options.db, options.contentRoot);
      const entities = await seedApiEntities(options.db, resources);
      log(
        `[content-refresh] reason=${reason} resources=${resources.length} entities=${entities.length}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown auto-refresh error.";
      log(`[content-refresh] failed: ${message}`);
    } finally {
      refreshInFlight = false;

      if (refreshQueued) {
        refreshQueued = false;
        void refresh("queued");
      }
    }
  };

  const scheduleRefresh = (reason: string): void => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      void refresh(reason);
    }, debounceMs);
  };

  try {
    watcher = watch(
      options.contentRoot,
      { recursive: true },
      (_eventType, filename) => {
        if (!filename) {
          scheduleRefresh("unknown");
          return;
        }

        const changedPath = filename.toString();
        if (changedPath.endsWith(".json")) {
          scheduleRefresh(changedPath);
        }
      },
    );

    watcher.on("error", (error) => {
      const message =
        error instanceof Error ? error.message : "Unknown watcher error.";
      log(`[content-refresh] watcher error: ${message}`);
    });

    log(`[content-refresh] watching ${options.contentRoot}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown watcher startup error.";
    log(`[content-refresh] disabled: ${message}`);
  }

  return {
    stop: () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      watcher?.close();
      watcher = null;
    },
  };
}
