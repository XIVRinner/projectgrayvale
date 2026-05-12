import type { Routes } from "@angular/router";

export const CHANGELOG_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./changelog-page.component").then(
        (module) => module.ChangelogPageComponent,
      ),
  },
];
