import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { z } from "zod";

const serverRoot = resolve(__dirname, "..");
const repoRoot = resolve(serverRoot, "..");
const defaultConfigPaths = [
  resolve(serverRoot, "config", "server.properties"),
  resolve(serverRoot, "config", "server.yaml"),
  resolve(serverRoot, "config", "server.yml")
] as const;

const configFileSchema = z.object({
  name: z.string().trim().min(1, 'Config field "name" is required.'),
  clientId: z.string().trim().min(1, 'Config field "clientId" is required.'),
  clientSecret: z.string().trim().min(1, 'Config field "clientSecret" is required.'),
  adminPassword: z.string().trim().min(1, 'Config field "adminPassword" is required.'),
  port: z.string().trim().optional(),
  dbFilePath: z.string().trim().optional(),
  contentRoot: z.string().trim().optional()
});

type RawConfigValues = Record<string, string>;

export interface ServerConfig {
  readonly name: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly adminPassword: string;
  readonly port: number;
  readonly dbFilePath: string;
  readonly contentRoot: string;
  readonly configFilePath: string;
}

export function readServerConfig(): ServerConfig {
  const configFilePath = resolveConfigFilePath(process.env["GRAYVALE_CONFIG_PATH"]);
  const configValues = readConfigValues(configFilePath);

  return {
    name: readRequiredSetting("GRAYVALE_NAME", process.env["GRAYVALE_NAME"], configValues.name),
    clientId: readRequiredSetting(
      "GRAYVALE_CLIENT_ID",
      process.env["GRAYVALE_CLIENT_ID"],
      configValues.clientId
    ),
    clientSecret: readRequiredSetting(
      "GRAYVALE_CLIENT_SECRET",
      process.env["GRAYVALE_CLIENT_SECRET"],
      configValues.clientSecret
    ),
    adminPassword: readRequiredSetting(
      "GRAYVALE_ADMIN_PASSWORD",
      process.env["GRAYVALE_ADMIN_PASSWORD"],
      configValues.adminPassword
    ),
    port: readPort(process.env["PORT"] ?? configValues.port),
    dbFilePath:
      readOptionalSetting(process.env["GRAYVALE_DB_PATH"]) ??
      resolveConfigRelativePath(configFilePath, configValues.dbFilePath) ??
      resolve(serverRoot, "data", "grayvale.sqlite"),
    contentRoot:
      readOptionalSetting(process.env["GRAYVALE_CONTENT_ROOT"]) ??
      resolveConfigRelativePath(configFilePath, configValues.contentRoot) ??
      resolve(repoRoot, "game", "src", "assets", "data"),
    configFilePath
  };
}

function readPort(raw: string | undefined): number {
  if (!raw) {
    return 3000;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value "${raw}".`);
  }

  return parsed;
}

function resolveConfigFilePath(explicitPath: string | undefined): string {
  const trimmedExplicitPath = explicitPath?.trim();

  if (trimmedExplicitPath) {
    const resolvedPath = resolve(trimmedExplicitPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(
        `GRAYVALE_CONFIG_PATH points to "${resolvedPath}", but that file does not exist.`
      );
    }

    return resolvedPath;
  }

  for (const candidate of defaultConfigPaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const defaultLocations = defaultConfigPaths.map((candidate) => `- ${candidate}`).join("\n");

  throw new Error(
    `Missing server config file. Create one at one of these locations:\n${defaultLocations}`
  );
}

function readConfigValues(configFilePath: string): z.infer<typeof configFileSchema> {
  const rawConfig = readFileSync(configFilePath, "utf8");
  const parsedConfig = parseConfigFile(configFilePath, rawConfig);
  const result = configFileSchema.safeParse(parsedConfig);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const keyPath = issue.path.length > 0 ? issue.path.join(".") : "config";
        return `- ${keyPath}: ${issue.message}`;
      })
      .join("\n");

    throw new Error(`Invalid server config file "${configFilePath}":\n${details}`);
  }

  return result.data;
}

function parseConfigFile(configFilePath: string, source: string): RawConfigValues {
  const extension = extname(configFilePath).toLowerCase();

  if (extension === ".properties") {
    return parseFlatConfig(source, configFilePath, ["=", ":"]);
  }

  if (extension === ".yaml" || extension === ".yml") {
    return parseFlatConfig(source, configFilePath, [":"]);
  }

  throw new Error(
    `Unsupported config file extension "${extension}" for "${configFilePath}". Use .properties, .yaml, or .yml.`
  );
}

function parseFlatConfig(
  source: string,
  configFilePath: string,
  separators: readonly string[]
): RawConfigValues {
  const values: RawConfigValues = {};
  const lines = source.split(/\r?\n/u);

  for (const [lineIndex, rawLine] of lines.entries()) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine || trimmedLine === "---" || trimmedLine.startsWith("#") || trimmedLine.startsWith(";")) {
      continue;
    }

    const separatorIndex = findSeparatorIndex(rawLine, separators);

    if (separatorIndex < 0) {
      throw new Error(
        `Invalid config entry in "${configFilePath}" on line ${lineIndex + 1}. Expected one of: ${separators.join(", ")}`
      );
    }

    const key = rawLine.slice(0, separatorIndex).trim();
    const value = rawLine.slice(separatorIndex + 1).trim();

    if (!key) {
      throw new Error(`Invalid config entry in "${configFilePath}" on line ${lineIndex + 1}. Missing key.`);
    }

    values[key] = stripWrappingQuotes(value);
  }

  return values;
}

function findSeparatorIndex(rawLine: string, separators: readonly string[]): number {
  for (let index = 0; index < rawLine.length; index += 1) {
    if (separators.includes(rawLine[index] ?? "")) {
      return index;
    }
  }

  return -1;
}

function stripWrappingQuotes(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function resolveConfigRelativePath(
  configFilePath: string,
  rawPath: string | undefined
): string | undefined {
  if (!rawPath) {
    return undefined;
  }

  if (isAbsolute(rawPath)) {
    return rawPath;
  }

  return resolve(dirname(configFilePath), rawPath);
}

function readRequiredSetting(
  envName: string,
  envValue: string | undefined,
  fallbackValue: string
): string {
  const trimmedValue = readOptionalSetting(envValue);

  if (trimmedValue !== undefined) {
    return trimmedValue;
  }

  if (envValue !== undefined) {
    throw new Error(`${envName} cannot be empty when it is set.`);
  }

  return fallbackValue;
}

function readOptionalSetting(raw: string | undefined): string | undefined {
  const trimmedValue = raw?.trim();

  return trimmedValue ? trimmedValue : undefined;
}
