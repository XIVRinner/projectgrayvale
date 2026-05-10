import { Injector, runInInjectionContext } from "@angular/core";
import { firstValueFrom, of } from "rxjs";

import { GameApiCacheService } from "../game-api-cache.service";
import { ChatEmotesLoader } from "./chat-emotes.loader";

describe("ChatEmotesLoader", () => {
  it("parses chat emotes into reusable custom emoji entries", async () => {
    const loader = createChatEmotesLoader([
      {
        id: "grayvale",
        name: "Gray Vale",
        emojis: [
          {
            id: "warden",
            name: "Warden",
            keywords: ["tank", "guard"],
            src: "assets/images/character/talent-icons/warden.png",
          },
        ],
      },
    ]);

    await expect(firstValueFrom(loader.load())).resolves.toEqual([
      {
        id: "warden",
        shortcode: ":warden:",
        name: "Warden",
        keywords: ["tank", "guard"],
        src: "assets/images/character/talent-icons/warden.png",
        categoryId: "grayvale",
        categoryName: "Gray Vale",
      },
    ]);
  });
});

function createChatEmotesLoader(payload: unknown): ChatEmotesLoader {
  const injector = Injector.create({
    providers: [
      {
        provide: GameApiCacheService,
        useValue: {
          getJsonWithFallback: jest.fn(() => of(payload)),
        },
      },
    ],
  });

  return runInInjectionContext(injector, () => new ChatEmotesLoader());
}
