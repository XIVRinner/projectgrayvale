import { Injector, runInInjectionContext } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstValueFrom, of } from "rxjs";

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
      }
    ]);
  });
});

function createDialogueDefinitionsLoader(payload: unknown): DialogueDefinitionsLoader {
  const http = {
    get: jest.fn(() => of(payload))
  };
  const injector = Injector.create({
    providers: [{ provide: HttpClient, useValue: http }]
  });

  return runInInjectionContext(injector, () => new DialogueDefinitionsLoader());
}
