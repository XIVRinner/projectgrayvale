import { Injector, runInInjectionContext } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { TextDecoder } from "node:util";
import { firstValueFrom, of } from "rxjs";

import { GameApiCacheService } from "../game-api-cache.service";
import { DialogueProjectLoader } from "./dialogue-project.loader";

describe("DialogueProjectLoader", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "TextDecoder", {
      configurable: true,
      value: TextDecoder
    });
  });

  it("loads the project manifest and decodes each dialogue asset to text", async () => {
    const loader = createDialogueProjectLoader({
      "/api/data/dialogue-project": {
        files: ["assets/dialogue/globals.fsc", "assets/dialogue/prologue/valeflow-prologue.fsc"]
      },
      "assets/dialogue/globals.fsc": encodeDialogueSource(
        'declare global chief = Actor("Village Chief")'
      ),
      "assets/dialogue/prologue/valeflow-prologue.fsc": encodeDialogueSource(
        'chapter START:\n    chief "Wake up."'
      )
    });

    await expect(firstValueFrom(loader.load())).resolves.toEqual([
      {
        filename: "globals.fsc",
        source: 'declare global chief = Actor("Village Chief")'
      },
      {
        filename: "prologue/valeflow-prologue.fsc",
        source: 'chapter START:\n    chief "Wake up."'
      }
    ]);
  });
});

function createDialogueProjectLoader(
  responses: Record<string, unknown>
): DialogueProjectLoader {
  const apiCache = {
    getJson: jest.fn((url: string) => {
      const response = responses[url];

      if (response === undefined) {
        throw new Error(`Unexpected request for ${url}.`);
      }

      return of(response);
    })
  };
  const http = {
    get: jest.fn((url: string) => {
      const response = responses[url];

      if (response === undefined) {
        throw new Error(`Unexpected request for ${url}.`);
      }

      return of(response);
    })
  };
  const injector = Injector.create({
    providers: [
      { provide: HttpClient, useValue: http },
      { provide: GameApiCacheService, useValue: apiCache }
    ]
  });

  return runInInjectionContext(injector, () => new DialogueProjectLoader());
}

function encodeDialogueSource(source: string): ArrayBuffer {
  const encoded = Buffer.from(source, "utf8");
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;
}
