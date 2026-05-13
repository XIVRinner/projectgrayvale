import type { ServerConfig } from "../config";
import { generateServerProfileToken } from "./server-profile-token";

export interface ServerProfileResponse {
  readonly serverName: string;
  readonly customContent: boolean;
  readonly profileToken: string;
}

/**
 * Builds the public server profile response.
 * The clientSecret is used to sign the token but is never returned to the client.
 */
export function buildServerProfile(config: ServerConfig): ServerProfileResponse {
  const profileToken = generateServerProfileToken(
    config.name,
    config.customContent,
    config.clientSecret,
  );

  return {
    serverName: config.name,
    customContent: config.customContent,
    profileToken,
  };
}
