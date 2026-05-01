import { Injector, runInInjectionContext } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { firstValueFrom, of } from "rxjs";

import { DialogueActorsLoader } from "./dialogue-actors.loader";

describe("DialogueActorsLoader", () => {
  it("parses narrator, village chief, and player actor metadata", async () => {
    const loader = createDialogueActorsLoader(
      JSON.parse(
        readFileSync(resolve(__dirname, "../../../assets/data/dialogue-actors.json"), "utf8")
      ) as unknown
    );

    await expect(firstValueFrom(loader.load())).resolves.toEqual([
      {
        id: "narrator",
        name: "Narrator",
        title: "Fading Consciousness",
        portraitPath: "assets/images/dialogue-heads/narrator.png"
      },
      {
        id: "village-chief",
        name: "Village Chief",
        title: "Chief of Arkama",
        portraitPath: "assets/images/dialogue-heads/village-chief.png"
      },
      {
        id: "player",
        name: "You",
        title: "Unknown Adventurer",
        portraitPath: "assets/images/player-avatar.svg"
      }
    ]);
  });
});

function createDialogueActorsLoader(payload: unknown): DialogueActorsLoader {
  const http = {
    get: jest.fn(() => of(payload))
  };
  const injector = Injector.create({
    providers: [{ provide: HttpClient, useValue: http }]
  });

  return runInInjectionContext(injector, () => new DialogueActorsLoader());
}
