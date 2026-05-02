export type ActionPanelGroupKind =
  | "pinned"
  | "movement"
  | "travel"
  | "fast-travel"
  | "talk"
  | "activity"
  | "combat"
  | "raid"
  | "dungeon"
  | "shop"
  | "crafting"
  | "quest";

export type ActionPanelGroupThemeKey = ActionPanelGroupKind;

export interface ActionPanelGroupDraft<TChoice> {
  readonly kind: ActionPanelGroupKind;
  readonly choices: readonly TChoice[];
}

export interface ActionPanelGroupView<TChoice> extends ActionPanelGroupDraft<TChoice> {
  readonly label: string;
  readonly themeKey: ActionPanelGroupThemeKey;
}

interface ActionPanelGroupDefinition {
  readonly label: string;
  readonly themeKey: ActionPanelGroupThemeKey;
  readonly sortOrder: number;
}

const ACTION_PANEL_GROUP_DEFINITIONS = {
  pinned: {
    label: "PINNED",
    themeKey: "pinned",
    sortOrder: 0
  },
  movement: {
    label: "MOVEMENT",
    themeKey: "movement",
    sortOrder: 100
  },
  travel: {
    label: "TRAVEL",
    themeKey: "travel",
    sortOrder: 200
  },
  "fast-travel": {
    label: "FAST TRAVEL",
    themeKey: "fast-travel",
    sortOrder: 300
  },
  talk: {
    label: "TALK",
    themeKey: "talk",
    sortOrder: 400
  },
  activity: {
    label: "ACTIVITY",
    themeKey: "activity",
    sortOrder: 500
  },
  combat: {
    label: "COMBAT",
    themeKey: "combat",
    sortOrder: 600
  },
  raid: {
    label: "RAID",
    themeKey: "raid",
    sortOrder: 700
  },
  dungeon: {
    label: "DUNGEON",
    themeKey: "dungeon",
    sortOrder: 800
  },
  shop: {
    label: "SHOP",
    themeKey: "shop",
    sortOrder: 900
  },
  crafting: {
    label: "CRAFTING",
    themeKey: "crafting",
    sortOrder: 1000
  },
  quest: {
    label: "QUEST",
    themeKey: "quest",
    sortOrder: 1100
  }
} satisfies Record<ActionPanelGroupKind, ActionPanelGroupDefinition>;

export function buildActionPanelGroup<TChoice>(
  kind: ActionPanelGroupKind,
  choices: readonly TChoice[]
): ActionPanelGroupView<TChoice> {
  const definition = ACTION_PANEL_GROUP_DEFINITIONS[kind];

  return {
    kind,
    label: definition.label,
    themeKey: definition.themeKey,
    choices
  };
}

export function mergeActionPanelGroups<TChoice>(
  groups: readonly ActionPanelGroupDraft<TChoice>[]
): readonly ActionPanelGroupView<TChoice>[] {
  const choicesByKind = new Map<ActionPanelGroupKind, TChoice[]>();

  for (const group of groups) {
    if (group.choices.length === 0) {
      continue;
    }

    const existingChoices = choicesByKind.get(group.kind) ?? [];
    existingChoices.push(...group.choices);
    choicesByKind.set(group.kind, existingChoices);
  }

  return [...choicesByKind.entries()]
    .sort(([leftKind], [rightKind]) => compareActionPanelGroupKinds(leftKind, rightKind))
    .map(([kind, choices]) => buildActionPanelGroup(kind, choices));
}

function compareActionPanelGroupKinds(
  left: ActionPanelGroupKind,
  right: ActionPanelGroupKind
): number {
  return (
    ACTION_PANEL_GROUP_DEFINITIONS[left].sortOrder -
    ACTION_PANEL_GROUP_DEFINITIONS[right].sortOrder
  );
}
