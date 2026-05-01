import { ApplicationConfig, ENVIRONMENT_INITIALIZER, inject, provideBrowserGlobalErrorListeners } from "@angular/core";
import { provideHttpClient } from "@angular/common/http";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { providePrimeNG } from "primeng/config";

import { GameSettingsService } from "./core/services/game-settings.service";
import { routes } from "./app.routes";
import { GrayValeTheme } from "./shared/theme/primeng-theme";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding()),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        inject(GameSettingsService);
      }
    },
    providePrimeNG({
      theme: {
        preset: GrayValeTheme
      }
    })
  ]
};
