import { Routes } from "@angular/router";

export const COMBAT_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./combat-container.component").then((m) => m.CombatContainerComponent)
  }
];
