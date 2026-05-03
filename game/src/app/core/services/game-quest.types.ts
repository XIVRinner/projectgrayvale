export type GameQuestEvent =
  | {
      type: "quest-start-queued";
      questId: string;
      message: string;
    }
  | {
      type: "quest-started";
      questId: string;
      message: string;
    }
  | {
      type: "quest-progressed";
      questId: string;
      message: string;
    }
  | {
      type: "quest-completed";
      questId: string;
      message: string;
    };
