import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { decodeServerProfileToken } from "../utils/server-profile-token";
import {
  getKnownServerProfile,
  upsertKnownServerProfile,
  type KnownServerProfile,
} from "../../data/known-servers-cache";

export interface ServerProfile {
  readonly serverName: string;
  readonly customContent: boolean;
  readonly profileToken: string;
}

export interface ServerProfileCheckResult {
  readonly allowed: boolean;
  readonly profile: ServerProfile | null;
  /** Set when a previously seen server profile has a different token now. */
  readonly tokenChanged: boolean;
  readonly error?: string;
}

@Injectable({ providedIn: "root" })
export class ServerProfileService {
  private readonly http = inject(HttpClient);

  private readonly profileState = signal<ServerProfile | null>(null);
  private readonly previousProfileState = signal<KnownServerProfile | null>(null);

  readonly currentProfile = this.profileState.asReadonly();
  readonly previousProfile = this.previousProfileState.asReadonly();

  /**
   * Fetch the server profile from the given API URL base and perform a
   * pre-connect compatibility check.
   *
   * Rules:
   * - customContent = false → allow connection (no signature needed).
   * - customContent = true → validate token structure; block if malformed.
   *   (Full HMAC verification happens server-side during character selection.)
   *
   * Also persists the profile to the local known-servers cache and detects
   * token changes from previously seen profiles.
   */
  async checkServerProfile(serverApiBaseUrl: string): Promise<ServerProfileCheckResult> {
    let response: ServerProfile;

    try {
      response = await firstValueFrom(
        this.http.get<ServerProfile>(`${serverApiBaseUrl}/api/server/profile`),
      );
    } catch {
      return {
        allowed: false,
        profile: null,
        tokenChanged: false,
        error: "Could not fetch server profile. The server may be unavailable.",
      };
    }

    // Validate token structure.
    const decodeResult = decodeServerProfileToken(response.profileToken);

    if (!decodeResult.ok || !decodeResult.content) {
      return {
        allowed: false,
        profile: response,
        tokenChanged: false,
        error: `Server compatibility token is malformed: ${decodeResult.error ?? "Unknown error."}`,
      };
    }

    const content = decodeResult.content;

    // If customContent = true, the token must decode and have the right content,
    // but we cannot verify the HMAC signature client-side (see token module docs).
    // The server will enforce signature validity during character selection.
    if (content.customContent === 1 && !response.customContent) {
      // Mismatch between profile field and token content — likely tampered.
      return {
        allowed: false,
        profile: response,
        tokenChanged: false,
        error: "Server profile and token content are inconsistent. This server profile may be invalid.",
      };
    }

    this.profileState.set(response);

    // Load previous profile for change detection.
    let tokenChanged = false;
    const previous = await getKnownServerProfile(response.serverName).catch(() => null);

    if (previous) {
      tokenChanged = previous.profileToken !== response.profileToken;
      this.previousProfileState.set(previous);
    }

    // Persist / update known servers cache.
    await upsertKnownServerProfile({
      serverName: response.serverName,
      customContent: response.customContent,
      profileToken: response.profileToken,
    }).catch(() => {
      // Non-fatal — cache failure should not block connection.
    });

    // For official (non-custom) servers, always allow.
    if (!response.customContent) {
      return { allowed: true, profile: response, tokenChanged };
    }

    // Custom content server — structurally valid. Allow with the understanding
    // that character compatibility is enforced server-side on select.
    return { allowed: true, profile: response, tokenChanged };
  }
}
