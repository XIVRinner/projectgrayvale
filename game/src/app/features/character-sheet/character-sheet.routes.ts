import { Routes } from "@angular/router";

export const CHARACTER_SHEET_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./equipment-panel/equipment-panel-container.component").then(
        (m) => m.EquipmentPanelContainerComponent
      )
  }
];
