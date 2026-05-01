import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { type Skill, skillSchema } from "@rinner/grayvale-core";
import { map, Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class SkillsLoader {
  private readonly http = inject(HttpClient);

  load(): Observable<readonly Skill[]> {
    return this.http.get<unknown>("assets/data/skills.json").pipe(
      map((raw) => parseSkills(raw))
    );
  }
}

function parseSkills(raw: unknown): readonly Skill[] {
  if (!Array.isArray(raw)) {
    throw new Error("skills.json must be an array.");
  }

  return raw.map((entry) => skillSchema.parse(entry));
}
