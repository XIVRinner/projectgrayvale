import { ChangeDetectionStrategy, Component, computed, input, signal } from "@angular/core";

import { StatCardComponent } from "./stat-card.component";
import type { StatAccordionItem } from "./stat-accordion.types";

@Component({
  selector: "gv-stat-accordion",
  standalone: true,
  imports: [StatCardComponent],
  templateUrl: "./stat-accordion.component.html",
  styleUrl: "./stat-accordion.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatAccordionComponent {
  readonly attributes = input<readonly StatAccordionItem[]>([]);
  readonly skills = input<readonly StatAccordionItem[]>([]);

  protected readonly attributesOpen = signal(true);
  protected readonly skillsOpen = signal(true);
  protected readonly skillGroups = computed(() => groupSkills(this.skills()));
  protected readonly openSkillGroups = signal<Record<string, boolean>>({});

  protected toggleAttributes(): void {
    this.attributesOpen.update((open) => !open);
  }

  protected toggleSkills(): void {
    this.skillsOpen.update((open) => !open);
  }

  protected toggleSkillGroup(groupId: string): void {
    this.openSkillGroups.update((state) => ({
      ...state,
      [groupId]: !state[groupId]
    }));
  }

  protected isSkillGroupOpen(groupId: string): boolean {
    return this.openSkillGroups()[groupId] ?? true;
  }
}

interface SkillGroup {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly subgroups: readonly SkillSubgroup[];
}

interface SkillSubgroup {
  readonly id: string;
  readonly label: string | null;
  readonly items: readonly StatAccordionItem[];
}

function groupSkills(skills: readonly StatAccordionItem[]): readonly SkillGroup[] {
  const groups = new Map<string, { label: string; entries: StatAccordionItem[] }>();

  for (const skill of skills) {
    // Skill tags are treated as ordered: first tag is the broad category, second tag is the more specific bucket.
    const primaryTag = prettyTag(skill.tags?.[0] ?? "other");
    const group = groups.get(primaryTag) ?? { label: primaryTag, entries: [] };

    group.entries.push(skill);
    groups.set(primaryTag, group);
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      label: group.label,
      count: group.entries.length,
      subgroups: buildSkillSubgroups(group.entries)
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function buildSkillSubgroups(skills: readonly StatAccordionItem[]): readonly SkillSubgroup[] {
  const subgroups = new Map<string, { label: string | null; items: StatAccordionItem[] }>();

  for (const skill of skills) {
    const secondaryTag = skill.tags?.[1] ? prettyTag(skill.tags[1]) : null;
    const subgroupId = secondaryTag ?? "__general";
    const subgroup = subgroups.get(subgroupId) ?? { label: secondaryTag, items: [] };

    subgroup.items.push(skill);
    subgroups.set(subgroupId, subgroup);
  }

  return [...subgroups.entries()]
    .map(([id, subgroup]) => ({
      id,
      label: subgroup.label,
      items: subgroup.items
    }))
    .sort((left, right) => {
      if (left.label === null) {
        return -1;
      }

      if (right.label === null) {
        return 1;
      }

      return left.label.localeCompare(right.label);
    });
}

function prettyTag(value: string): string {
  return value
    .split(/[_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
