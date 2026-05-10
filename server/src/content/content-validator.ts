export function validateJsonDocument(resourceKey: string, payload: unknown): void {
  if (payload === null || payload === undefined) {
    throw new Error(`Resource "${resourceKey}" must not be empty.`);
  }
}
