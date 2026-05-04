import type { CompileDiagnostic } from "./gameplay-execution-graph.types";

export function errorDiagnostic(
  code: string,
  message: string,
  source?: CompileDiagnostic["source"]
): CompileDiagnostic {
  return { severity: "error", code, message, ...(source ? { source } : {}) };
}

export function warningDiagnostic(
  code: string,
  message: string,
  source?: CompileDiagnostic["source"]
): CompileDiagnostic {
  return { severity: "warning", code, message, ...(source ? { source } : {}) };
}

export function infoDiagnostic(
  code: string,
  message: string,
  source?: CompileDiagnostic["source"]
): CompileDiagnostic {
  return { severity: "info", code, message, ...(source ? { source } : {}) };
}

export function logDiagnostics(diagnostics: readonly CompileDiagnostic[]): void {
  for (const d of diagnostics) {
    const location = d.source?.path ?? d.source?.id ?? "";
    const prefix = location ? `[${location}] ` : "";

    if (d.severity === "error") {
      console.error(`[GEG] ${prefix}${d.code}: ${d.message}`);
    } else if (d.severity === "warning") {
      console.warn(`[GEG] ${prefix}${d.code}: ${d.message}`);
    } else {
      console.info(`[GEG] ${prefix}${d.code}: ${d.message}`);
    }
  }
}
