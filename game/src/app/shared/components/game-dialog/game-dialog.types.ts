export type GameDialogMode = "valeflow" | "combat" | "activity";

export interface GameDialogActorView {
  readonly id: string;
  readonly name: string;
  readonly title?: string;
  readonly portraitPath?: string;
}

export interface GameDialogChoiceView {
  readonly index: number;
  readonly label: string;
  readonly seen: boolean;
}

export interface GameDialogTranscriptEntry {
  readonly id: string;
  readonly kind: "say" | "narration";
  readonly actor?: GameDialogActorView | null;
  readonly text: string;
}

export interface GameDialogSessionView {
  readonly mode: GameDialogMode;
  readonly title: string;
  readonly eyebrow?: string | null;
  readonly subtitle?: string | null;
  readonly sceneImagePath?: string | null;
  readonly transcript: readonly GameDialogTranscriptEntry[];
  readonly currentEntry: GameDialogTranscriptEntry | null;
  readonly choices: readonly GameDialogChoiceView[];
  readonly canAdvance: boolean;
  readonly isAwaitingChoice: boolean;
}

export type GameDialogEvent =
  | {
      readonly type: "session-started";
      readonly mode: GameDialogMode;
      readonly title: string;
      readonly eyebrow?: string | null;
      readonly subtitle?: string | null;
    }
  | {
      readonly type: "line-shown";
      readonly entry: GameDialogTranscriptEntry;
    }
  | {
      readonly type: "choices-presented";
      readonly choices: readonly GameDialogChoiceView[];
    }
  | {
      readonly type: "choice-selected";
      readonly choice: GameDialogChoiceView;
    }
  | {
      readonly type: "session-ended";
      readonly appliedDeltaCount: number;
    };
