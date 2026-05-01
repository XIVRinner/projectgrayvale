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
      }
    ]
  }
];
