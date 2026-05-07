import { Routes } from "@angular/router";

export const CHARACTER_SHEET_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./character-sheet-container.component").then(
        (m) => m.CharacterSheetContainerComponent
      )
  }
];
