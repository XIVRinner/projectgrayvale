import { applyDelta, applyDeltas, type GameState } from "../delta";
import type { Player } from "../models";
import { getCurrentChapter, isChapterReached, type StoryArc } from "./index";

const createPlayer = (): Player => ({
  id: "player_story_test",
  name: "Story Test Player",
  description: "A player used for story tests.",
  raceId: "race_human",
  jobClass: "wanderer",
  progression: {
    level: 1,
    experience: 0
  },
  adventurerRank: 1,
  attributes: {
    strength: 5
  },
  skills: {
    mining: 2
  },
  inventory: {
    items: {}
  },
  equippedItems: {}
});

const arc: StoryArc = {
  id: "arc_main",
  title: "Main Arc",
  chapters: {
    1: {
      number: 1,
      title: "Arrival",
      isPrologue: true
    },
    2: {
      number: 2,
      title: "First Oath"
    }
  }
};

describe("story helper functions", () => {
  it("retrieves the current chapter", () => {
    expect(
      getCurrentChapter(arc, {
        currentArcId: "arc_main",
        currentChapter: 2
      })
    ).toEqual({
      number: 2,
      title: "First Oath"
    });
  });

  it("throws when the arc and state do not match", () => {
    expect(() =>
      getCurrentChapter(arc, {
        currentArcId: "arc_side",
        currentChapter: 1
      })
    ).toThrow('Story arc mismatch: expected "arc_side", received "arc_main".');
  });

  it("evaluates chapter reachability", () => {
    const state = {
      currentArcId: "arc_main",
      currentChapter: 3,
      completedChapters: [1, 2]
    };

    expect(isChapterReached(state, 2)).toBe(true);
    expect(isChapterReached(state, 3)).toBe(true);
    expect(isChapterReached(state, 4)).toBe(false);
  });
});

describe("story state transitions", () => {
  it("supports delta paths for chapter and arc", () => {
    const state: GameState = {
      player: createPlayer(),
      npcs: {}
    };

    expect(
      applyDeltas(state, [
        {
          type: "set",
          target: "player",
          path: ["story", "currentArcId"],
          value: "arc_main"
        },
        {
          type: "set",
          target: "player",
          path: ["story", "currentChapter"],
          value: 1
        },
        {
          type: "set",
          target: "player",
          path: ["story", "completedChapters"],
          value: [1]
        }
      ])
    ).toEqual({
      ...state,
      player: {
        ...state.player,
        story: {
          currentArcId: "arc_main",
          currentChapter: 1,
          completedChapters: [1]
        }
      }
    });
  });

  it("updates an existing chapter value", () => {
    const state: GameState = {
      player: {
        ...createPlayer(),
        story: {
          currentArcId: "arc_main",
          currentChapter: 1,
          completedChapters: [1]
        }
      },
      npcs: {}
    };

    expect(
      applyDelta(state, {
        type: "set",
        target: "player",
        path: ["story", "currentChapter"],
        value: 2
      })
    ).toEqual({
      ...state,
      player: {
        ...state.player,
        story: {
          currentArcId: "arc_main",
          currentChapter: 2,
          completedChapters: [1]
        }
      }
    });
  });
});