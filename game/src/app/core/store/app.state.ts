/**
 * Root application state.
 * Feature-specific state is merged into this interface as they are added.
 */
export interface AppState {
  // Feature slices will be added here
  action?: unknown; // Will be typed from action feature
  statistics?: unknown; // Will be typed from statistics feature
}
