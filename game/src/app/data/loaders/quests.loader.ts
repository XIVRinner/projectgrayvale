import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import * as GrayvaleCore from "@rinner/grayvale-core";
import type { Quest } from "@rinner/grayvale-core";
import { map, type Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class QuestsLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<readonly Quest[]> {
    return this.http.get<unknown>("assets/data/quests.json").pipe(
      map((raw) => parseQuests(raw))
    );
  }
}

function parseQuests(raw: unknown): readonly Quest[] {
  if (!Array.isArray(raw)) {
    throw new Error("quests.json must be an array.");
  }

  const parseQuest = resolveQuestParser();

  return raw.map((entry) => parseQuest(entry));
}

function resolveQuestParser(): (value: unknown) => Quest {
  const parseQuestCandidate = (GrayvaleCore as { parseQuest?: unknown }).parseQuest;

  if (typeof parseQuestCandidate === "function") {
    return parseQuestCandidate as (value: unknown) => Quest;
  }

  const assertValidQuestCandidate = (GrayvaleCore as { assertValidQuest?: unknown }).assertValidQuest;

  if (typeof assertValidQuestCandidate === "function") {
    return (value: unknown): Quest => {
      (assertValidQuestCandidate as (candidate: unknown) => void)(value);
      return value as Quest;
    };
  }

  return parseQuestFallback;
}

function parseQuestFallback(value: unknown): Quest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Quest entry must be an object.");
  }

  const record = value as Record<string, unknown>;

  if (typeof record["id"] !== "string" || record["id"].trim().length === 0) {
    throw new Error("Quest entry id must be a non-empty string.");
  }

  if (!Array.isArray(record["objectives"])) {
    throw new Error(`Quest "${record["id"]}" objectives must be an array.`);
  }

  return value as Quest;
}
