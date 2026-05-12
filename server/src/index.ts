import { createApp } from "./app";
import { readServerConfig } from "./config";
import { startContentAutoRefresh } from "./content/content-auto-refresh";
import { openDatabase } from "./db/database";

async function main(): Promise<void> {
  const config = readServerConfig();
  const db = await openDatabase(config);
  const app = await createApp(config, db);
  const watcherEnabled = process.env["GRAYVALE_WATCH_CONTENT"] !== "false";
  const autoRefresh = watcherEnabled
    ? startContentAutoRefresh({
        db,
        contentRoot: config.contentRoot,
        logger: (message) => process.stdout.write(`${message}\n`),
      })
    : null;
  const databaseLabel =
    config.databaseProvider === "turso"
      ? config.tursoDatabaseUrl
      : config.dbFilePath;

  const stopAutoRefresh = (): void => {
    autoRefresh?.stop();
  };

  process.once("SIGINT", stopAutoRefresh);
  process.once("SIGTERM", stopAutoRefresh);

  app.listen(config.port, () => {
    process.stdout.write(
      `${config.name} listening on http://localhost:${config.port} using ${config.databaseProvider}:${databaseLabel} (config: ${config.configFilePath})\n`
    );
    if (watcherEnabled) {
      process.stdout.write(
        `[content-refresh] enabled (set GRAYVALE_WATCH_CONTENT=false to disable)\n`,
      );
    }
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
