import { ApplicationConfig, provideBrowserGlobalErrorListeners } from "@angular/core";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { providePrimeNG } from "primeng/config";

import { routes } from "./app.routes";
import { GrayValeTheme } from "./shared/theme/primeng-theme";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    providePrimeNG({
      theme: {
        preset: GrayValeTheme
      }
    })
  ]
};
