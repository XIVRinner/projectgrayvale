import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { type LoadInput } from "@rinner/grayvale-dialogue";
import { forkJoin, map, shareReplay, switchMap, type Observable } from "rxjs";

interface DialogueProjectManifest {
  readonly files: readonly string[];
}

@Injectable({ providedIn: "root" })
export class DialogueProjectLoader {
  private readonly http = inject(HttpClient);

  private readonly project$ = this.http
    .get<unknown>("assets/data/dialogue-project.json")
    .pipe(
      map((raw) => parseDialogueProjectManifest(raw)),
      switchMap((manifest) =>
        forkJoin(
          manifest.files.map((assetPath) =>
            this.http.get(assetPath, { responseType: "arraybuffer" }).pipe(
              map(
                (sourceBuffer) =>
                  ({
                    filename: toProjectFilename(assetPath),
                    source: decodeDialogueSource(sourceBuffer, assetPath)
                  }) satisfies LoadInput
              )
            )
          )
        )
      ),
      shareReplay({ bufferSize: 1, refCount: false })
    );

  load(): Observable<readonly LoadInput[]> {
    return this.project$;
  }
}

function parseDialogueProjectManifest(raw: unknown): DialogueProjectManifest {
  const record = ensureRecord(raw, "dialogue-project.json");
  const files = record["files"];

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("dialogue-project.json.files must be a non-empty array.");
  }

  return {
    files: files.map((value, index) =>
      ensureString(value, `dialogue-project.json.files[${index}]`)
    )
  };
}

export function toProjectFilename(assetPath: string): string {
  const normalizedPath = assetPath.replace(/\\/g, "/");
  const prefix = "assets/dialogue/";

  if (!normalizedPath.startsWith(prefix)) {
    throw new Error(
      `Dialogue project asset paths must start with "${prefix}", received "${assetPath}".`
    );
  }

  return normalizedPath.slice(prefix.length);
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}

function decodeDialogueSource(sourceBuffer: ArrayBuffer, assetPath: string): string {
  return ensureString(
    new TextDecoder().decode(sourceBuffer),
    `${assetPath} source`
  );
}
