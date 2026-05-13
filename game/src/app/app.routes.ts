import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./layout/shell/shell-container.component").then(
        (m) => m.ShellContainerComponent
      ),
    children: [
      {
        path: "",
        pathMatch: "full",
        loadComponent: () =>
          import("./features/home/home-container.component").then(
            (m) => m.HomeContainerComponent
          )
      },
      {
        path: "creator",
        pathMatch: "full",
        loadChildren: () =>
          import("./features/character-creator/character-creator.routes").then(
            (m) => m.CHARACTER_CREATOR_ROUTES
          )
      },
      {
        path: "character-sheet",
        loadChildren: () =>
          import("./features/character-sheet/character-sheet.routes").then(
            (m) => m.CHARACTER_SHEET_ROUTES
          )
      },
      {
        path: "combat",
        loadChildren: () =>
          import("./features/combat/combat.routes").then(
            (m) => m.COMBAT_ROUTES
          )
      },
      {
        path: "changelog",
        loadChildren: () =>
          import("./features/changelog/changelog.routes").then(
            (m) => m.CHANGELOG_ROUTES
          )
      },
      {
        path: "home",
        redirectTo: ""
      },
      {
        path: "profile",
        loadChildren: () =>
          import("./features/player-profile/player-profile.routes").then(
            (m) => m.PLAYER_PROFILE_ROUTES
          )
      }
    ]
  }
];
