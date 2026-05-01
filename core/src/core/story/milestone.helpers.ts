import type { Milestone, MilestoneId } from "./milestone.types";

export const getMilestoneById = (
  milestones: Milestone[],
  id: MilestoneId
): Milestone | undefined => milestones.find((milestone) => milestone.id === id);

export const getOrderedMilestones = (milestones: Milestone[]): Milestone[] =>
  milestones
    .map((milestone, index) => ({ milestone, index }))
    .sort((left, right) => {
      const leftOrder = left.milestone.order;
      const rightOrder = right.milestone.order;

      if (leftOrder === undefined && rightOrder === undefined) {
        return left.index - right.index;
      }

      if (leftOrder === undefined) {
        return 1;
      }

      if (rightOrder === undefined) {
        return -1;
      }

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.index - right.index;
    })
    .map(({ milestone }) => milestone);
