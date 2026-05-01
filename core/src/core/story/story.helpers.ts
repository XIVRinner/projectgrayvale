import type { StoryArc, StoryChapter, StoryState } from "./story.types";

export const getCurrentChapter = (
  arc: StoryArc,
  state: StoryState
): StoryChapter => {
  if (arc.id !== state.currentArcId) {
    throw new Error(
      `Story arc mismatch: expected "${state.currentArcId}", received "${arc.id}".`
    );
  }

  const chapter = arc.chapters[state.currentChapter];

  if (chapter === undefined) {
    throw new Error(
      `Chapter ${state.currentChapter} not found in arc "${arc.id}".`
    );
  }

  return chapter;
};

export const isChapterReached = (
  state: StoryState,
  chapterNumber: number
): boolean => {
  if (chapterNumber <= state.currentChapter) {
    return true;
  }

  return state.completedChapters?.includes(chapterNumber) ?? false;
};