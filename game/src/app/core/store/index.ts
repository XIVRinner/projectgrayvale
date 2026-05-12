import { provideStore } from "@ngrx/store";
import { provideEffects } from "@ngrx/effects";
import { provideStoreDevtools } from "@ngrx/store-devtools";

export const provideAppStore = () => [
  provideStore(),
  provideEffects(),
  provideStoreDevtools({ maxAge: 25, logOnly: true })
];

export * from "./app.state";
