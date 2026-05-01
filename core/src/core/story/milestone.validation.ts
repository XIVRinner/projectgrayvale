import { getMilestoneById } from "./milestone.helpers";
import type { Milestone, MilestoneId } from "./milestone.types";

const isPlainStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

function assertValidMilestoneId(
  id: unknown,
  index: number
): asserts id is MilestoneId {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error(`Milestone at index ${index} must have a non-empty string id.`);
  }
}

const visitDependencyGraph = (
  milestoneId: MilestoneId,
  dependencyMap: ReadonlyMap<MilestoneId, MilestoneId[]>,
  visiting: Set<MilestoneId>,
  visited: Set<MilestoneId>,
  path: MilestoneId[]
): void => {
  if (visited.has(milestoneId)) {
    return;
  }

  if (visiting.has(milestoneId)) {
    const cycleStartIndex = path.indexOf(milestoneId);
    const cyclePath = [...path.slice(cycleStartIndex), milestoneId].join(" -> ");
    throw new Error(`Circular milestone dependency detected: ${cyclePath}.`);
  }

  visiting.add(milestoneId);
  path.push(milestoneId);

  for (const dependencyId of dependencyMap.get(milestoneId) ?? []) {
    visitDependencyGraph(dependencyId, dependencyMap, visiting, visited, path);
  }

  path.pop();
  visiting.delete(milestoneId);
  visited.add(milestoneId);
};

export const validateMilestonesStructure = (milestones: Milestone[]): void => {
  if (!Array.isArray(milestones)) {
    throw new Error("Milestones must be an array.");
  }

  const seenIds = new Set<MilestoneId>();

  milestones.forEach((milestone, index) => {
    if (milestone === null || typeof milestone !== "object" || Array.isArray(milestone)) {
      throw new Error(`Milestone at index ${index} must be an object.`);
    }

    assertValidMilestoneId(milestone.id, index);

    if (seenIds.has(milestone.id)) {
      throw new Error(`Duplicate milestone id "${milestone.id}".`);
    }

    seenIds.add(milestone.id);

    if (milestone.order !== undefined) {
      if (typeof milestone.order !== "number" || !Number.isFinite(milestone.order)) {
        throw new Error(`Milestone "${milestone.id}" has an invalid order value.`);
      }
    }

    if (milestone.required !== undefined && typeof milestone.required !== "boolean") {
      throw new Error(`Milestone "${milestone.id}" has an invalid required value.`);
    }

    if (milestone.dependsOn !== undefined) {
      if (!isPlainStringArray(milestone.dependsOn)) {
        throw new Error(`Milestone "${milestone.id}" has an invalid dependsOn value.`);
      }

      milestone.dependsOn.forEach((dependencyId, dependencyIndex) => {
        if (dependencyId.trim().length === 0) {
          throw new Error(
            `Milestone "${milestone.id}" has an empty dependency id at index ${dependencyIndex}.`
          );
        }
      });
    }
  });
};

export const validateMilestoneDependencies = (milestones: Milestone[]): void => {
  validateMilestonesStructure(milestones);

  const dependencyMap = new Map<MilestoneId, MilestoneId[]>();

  milestones.forEach((milestone) => {
    const dependencies = milestone.dependsOn ?? [];

    dependencies.forEach((dependencyId) => {
      if (dependencyId === milestone.id) {
        throw new Error(`Milestone "${milestone.id}" cannot depend on itself.`);
      }

      if (getMilestoneById(milestones, dependencyId) === undefined) {
        throw new Error(
          `Milestone "${milestone.id}" depends on missing milestone "${dependencyId}".`
        );
      }
    });

    dependencyMap.set(milestone.id, [...dependencies]);
  });

  const visiting = new Set<MilestoneId>();
  const visited = new Set<MilestoneId>();

  milestones.forEach((milestone) => {
    visitDependencyGraph(milestone.id, dependencyMap, visiting, visited, []);
  });
};

export const validateMilestoneOrdering = (milestones: Milestone[]): void => {
  validateMilestonesStructure(milestones);

  const seenOrders = new Map<number, MilestoneId>();

  milestones.forEach((milestone) => {
    if (milestone.order === undefined) {
      return;
    }

    const existingMilestoneId = seenOrders.get(milestone.order);

    if (existingMilestoneId !== undefined) {
      throw new Error(
        `Milestone order ${milestone.order} is duplicated by "${existingMilestoneId}" and "${milestone.id}".`
      );
    }

    seenOrders.set(milestone.order, milestone.id);
  });

  milestones.forEach((milestone) => {
    if (milestone.order === undefined || milestone.dependsOn === undefined) {
      return;
    }

    milestone.dependsOn.forEach((dependencyId) => {
      const dependency = getMilestoneById(milestones, dependencyId);

      if (dependency === undefined || dependency.order === undefined) {
        return;
      }

      if (dependency.order >= milestone.order!) {
        throw new Error(
          `Milestone "${milestone.id}" has order ${milestone.order} but depends on "${dependency.id}" with order ${dependency.order}.`
        );
      }
    });
  });
};
