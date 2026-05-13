import { Routes } from "@angular/router";

export const PLAYER_PROFILE_ROUTES: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () =>
      import("./player-profile-container.component").then(
        (m) => m.PlayerProfileContainerComponent,
      ),
  },
];
