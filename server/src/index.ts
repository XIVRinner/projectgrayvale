import { createApp } from "./app";
import { readServerConfig } from "./config";
import { openDatabase } from "./db/database";

async function main(): Promise<void> {
  const config = readServerConfig();
  const db = await openDatabase(config);
  const app = await createApp(config, db);
  const databaseLabel =
    config.databaseProvider === "turso"
      ? config.tursoDatabaseUrl
      : config.dbFilePath;

  app.listen(config.port, () => {
    process.stdout.write(
      `${config.name} listening on http://localhost:${config.port} using ${config.databaseProvider}:${databaseLabel} (config: ${config.configFilePath})\n`
    );
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
