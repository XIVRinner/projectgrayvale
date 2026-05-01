import { Routes } from "@angular/router";

export const CHARACTER_CREATOR_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./character-creator-container.component").then(
        (m) => m.CharacterCreatorContainerComponent
      )
  }
];
