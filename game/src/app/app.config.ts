import { ApplicationConfig, ENVIRONMENT_INITIALIZER, inject, provideBrowserGlobalErrorListeners } from "@angular/core";
import { provideHttpClient } from "@angular/common/http";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { providePrimeNG } from "primeng/config";
import { MessageService } from "primeng/api";
import { provideStore } from "@ngrx/store";
import { provideEffects } from "@ngrx/effects";
import { provideStoreDevtools } from "@ngrx/store-devtools";

import { GameSettingsService } from "./core/services/game-settings.service";
import { ServerConnectionService } from "./core/services/server-connection.service";
import { ToastWatcherService } from "./core/services/toast-watcher.service";
import { NotificationWatcherService } from "./core/services/notification-watcher.service";
import { routes } from "./app.routes";
import { GrayValeTheme } from "./shared/theme/primeng-theme";
import { actionReducer, ActionEffects } from "./features/action/store";
import { statisticsReducer, StatisticsEffects } from "./features/statistics/store";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding()),
    provideStore({
      action: actionReducer,
      statistics: statisticsReducer
    }),
    provideEffects([ActionEffects, StatisticsEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: true }),
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        inject(ServerConnectionService);
        inject(GameSettingsService);
        inject(ToastWatcherService);
        inject(NotificationWatcherService);
      }
    },
    providePrimeNG({
      theme: {
        preset: GrayValeTheme
      }
    }),
    MessageService
  ]
};
