import { Injector, runInInjectionContext } from "@angular/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstValueFrom, of } from "rxjs";

import { GameApiCacheService } from "../game-api-cache.service";
import { DialogueDefinitionsLoader } from "./dialogue-definitions.loader";

describe("DialogueDefinitionsLoader", () => {
  it("parses keyed dialogue definitions for the game layer", async () => {
    const loader = createDialogueDefinitionsLoader(
      JSON.parse(
        readFileSync(resolve(__dirname, "../../../assets/data/dialogues.json"), "utf8")
      ) as unknown
    );

    await expect(firstValueFrom(loader.load())).resolves.toEqual([
      {
        id: "prologue",
        entryFile: "prologue/valeflow-prologue.fsc",
        title: "Wake Up",
        eyebrowFallback: "Prologue",
        subtitleFallback: "A hard-won return to consciousness."
      },
      {
        id: "chief-labour",
        entryFile: "prologue/chief-labour.fsc",
        title: "The Chief's Request",
        eyebrowFallback: "Chief House",
        subtitleFallback: "He has work for you."
      },
      {
        id: "chief-bridgitte-handoff",
        entryFile: "arkama/chief-bridgitte-handoff.fsc",
        title: "A New Lead",
        eyebrowFallback: "Arkama Village",
        subtitleFallback: "The chief has someone she wants you to meet."
      },
      {
        id: "bridgitte-house",
        entryFile: "arkama/bridgitte-house.fsc",
        title: "Bridgitte",
        eyebrowFallback: "Bridgitte's House",
        subtitleFallback: "A retired adventurer finally opens her door to you."
      },
      {
        id: "bridgitte-report-back",
        entryFile: "arkama/bridgitte-report-back.fsc",
        title: "Bridgitte",
        eyebrowFallback: "Bridgitte's House",
        subtitleFallback: "Your first contract is done, and Bridgitte has more direction for you."
      },
      {
        id: "bridgitte-repeatables",
        entryFile: "arkama/bridgitte-repetables.fsc",
        title: "Bridgitte",
        eyebrowFallback: "Bridgitte's House",
        subtitleFallback: "A retired adventurer answers what she is willing to share."
      }
    ]);
  });
});

function createDialogueDefinitionsLoader(payload: unknown): DialogueDefinitionsLoader {
  const apiCache = {
    getJsonWithFallback: jest.fn(() => of(payload))
  };
  const injector = Injector.create({
    providers: [{ provide: GameApiCacheService, useValue: apiCache }]
  });

  return runInInjectionContext(injector, () => new DialogueDefinitionsLoader());
}
