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
        path: "home",
        redirectTo: ""
      }
    ]
  }
];
