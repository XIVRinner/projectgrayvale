import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ServerConnectionService } from "./server-connection.service";

@Injectable({ providedIn: "root" })
export class SocialApiService {
  private readonly http = inject(HttpClient);
  private readonly serverConnection = inject(ServerConnectionService);

  async addFriend(target: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl("/api/social/friends/add"),
        { target },
        { withCredentials: true },
      ),
    );
  }

  async blockProfile(targetProfileId: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        this.serverConnection.serverApiUrl(`/api/social/blocks/${targetProfileId}`),
        {},
        { withCredentials: true },
      ),
    );
  }

  async getAdminProfileOverview(profileId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.get(
        this.serverConnection.serverApiUrl(`/api/social/admin/profile/${profileId}`),
        { withCredentials: true },
      ),
    );
  }
}
