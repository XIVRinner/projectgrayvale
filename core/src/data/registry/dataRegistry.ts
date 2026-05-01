import type { Skill, Weapon } from "../../core/models";
import { skillSchema, weaponSchema } from "../schemas";

export class DataRegistry {
  private readonly weapons = new Map<string, Weapon>();
  private readonly skills = new Map<string, Skill>();

  loadWeapons(data: unknown[]): void {
    for (const entry of data) {
      const weapon = weaponSchema.parse(entry);
      this.setUnique(this.weapons, weapon.id, weapon, "weapon");
    }
  }

  getWeapon(id: string): Weapon | undefined {
    return this.weapons.get(id);
  }

  loadSkills(data: unknown[]): void {
    for (const entry of data) {
      const skill = skillSchema.parse(entry);
      this.setUnique(this.skills, skill.id, skill, "skill");
    }
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  private setUnique<T>(registry: Map<string, T>, id: string, value: T, label: string): void {
    if (registry.has(id)) {
      throw new Error(`Duplicate ${label} id: ${id}`);
    }

    registry.set(id, value);
  }
}
