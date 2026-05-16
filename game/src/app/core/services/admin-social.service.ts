import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "./server-connection.service";
import type {
  AdminPlayerListEntryView,
  AdminProfileDetailView,
} from "./server-chat.models";

@Injectable({ providedIn: "root" })
export class AdminSocialService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);

  loadPlayers(input: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{ total: number; entries: readonly AdminPlayerListEntryView[] }> {
    return firstValueFrom(
      this.http.get<{
        total: number;
        entries: readonly AdminPlayerListEntryView[];
      }>(
        this.serverConnection.serverApiUrl("/api/social/admin/players"),
        {
          params: {
            page: String(input.page),
            pageSize: String(input.pageSize),
            ...(input.search ? { search: input.search } : {}),
          },
          withCredentials: true,
        },
      ),
    );
  }

  loadProfileDetail(profileId: string): Promise<AdminProfileDetailView> {
    return firstValueFrom(
      this.http.get<AdminProfileDetailView>(
        this.serverConnection.serverApiUrl(`/api/social/admin/profile/${profileId}`),
        { withCredentials: true },
      ),
    );
  }

  listGrantablePermissions(): Promise<readonly string[]> {
    return firstValueFrom(
      this.http.get<{ permissions: readonly string[] }>(
        this.serverConnection.serverApiUrl("/api/admin/permissions"),
        { withCredentials: true },
      ),
    ).then((response) => response.permissions);
  }

  grantPermission(profileId: string, permissionId: string): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/admin/profiles/${profileId}/permissions`),
        { permissionId },
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  revokePermission(profileId: string, permissionId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete(
        this.serverConnection.serverApiUrl(`/api/admin/profiles/${profileId}/permissions/${permissionId}`),
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  moderateProfile(
    profileId: string,
    action: "kick" | "ban" | "unban" | "mute" | "unmute" | "warn",
    payload: { reason?: string; expiresAt?: string },
  ): Promise<void> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/admin/profiles/${profileId}/${action}`),
        payload,
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  listNotes(profileId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.get(
        this.serverConnection.serverApiUrl(`/api/admin/profiles/${profileId}/notes`),
        { withCredentials: true },
      ),
    );
  }

  addNote(profileId: string, body: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/admin/profiles/${profileId}/notes`),
        { body },
        { withCredentials: true },
      ),
    );
  }

  updateNote(profileId: string, noteId: string, body: string): Promise<unknown> {
    return firstValueFrom(
      this.http.put(
        this.serverConnection.serverApiUrl(`/api/admin/profiles/${profileId}/notes/${noteId}`),
        { body },
        { withCredentials: true },
      ),
    );
  }

  deleteNote(profileId: string, noteId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete(
        this.serverConnection.serverApiUrl(`/api/admin/profiles/${profileId}/notes/${noteId}`),
        { withCredentials: true },
      ),
    ).then(() => undefined);
  }

  listAuditLog(input: {
    page: number;
    pageSize: number;
    targetProfileId?: string;
  }): Promise<unknown> {
    return firstValueFrom(
      this.http.get(
        this.serverConnection.serverApiUrl("/api/admin/audit-log"),
        {
          params: {
            page: String(input.page),
            pageSize: String(input.pageSize),
            ...(input.targetProfileId ? { targetProfileId: input.targetProfileId } : {}),
          },
          withCredentials: true,
        },
      ),
    );
  }
}
