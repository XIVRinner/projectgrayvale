import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getMilestoneById,
  getOrderedMilestones,
  validateMilestoneDependencies,
  validateMilestoneOrdering,
  validateMilestonesStructure,
  type ChapterMilestones,
  type Milestone
} from "./index";

const loadFixture = (): ChapterMilestones =>
  JSON.parse(
    readFileSync(join(__dirname, "milestone.fixture.json"), "utf8")
  ) as ChapterMilestones;

describe("milestone validation", () => {
  it("loads fixture, validates it, and orders milestones deterministically", () => {
    const fixture = loadFixture();

    expect(() => validateMilestonesStructure(fixture.milestones)).not.toThrow();
    expect(() => validateMilestoneDependencies(fixture.milestones)).not.toThrow();
    expect(() => validateMilestoneOrdering(fixture.milestones)).not.toThrow();

    expect(getMilestoneById(fixture.milestones, "training_started")).toEqual({
      id: "training_started",
      order: 2,
      required: true,
      dependsOn: ["intro_complete"]
    });

    expect(getOrderedMilestones(fixture.milestones).map((milestone) => milestone.id)).toEqual([
      "intro_complete",
      "training_started",
      "chapter_complete"
    ]);
  });

  it("throws on duplicate milestone ids", () => {
    const milestones: Milestone[] = [
      { id: "intro_complete" },
      { id: "intro_complete" }
    ];

    expect(() => validateMilestonesStructure(milestones)).toThrow(
      'Duplicate milestone id "intro_complete".'
    );
  });

  it("throws on missing dependencies", () => {
    const milestones: Milestone[] = [
      {
        id: "training_started",
        dependsOn: ["non_existing"]
      }
    ];

    expect(() => validateMilestoneDependencies(milestones)).toThrow(
      'Milestone "training_started" depends on missing milestone "non_existing".'
    );
  });

  it("throws on circular dependencies", () => {
    const milestones: Milestone[] = [
      { id: "A", dependsOn: ["B"] },
      { id: "B", dependsOn: ["A"] }
    ];

    expect(() => validateMilestoneDependencies(milestones)).toThrow(
      "Circular milestone dependency detected: A -> B -> A."
    );
  });

  it("throws on self dependency", () => {
    const milestones: Milestone[] = [
      {
        id: "intro_complete",
        dependsOn: ["intro_complete"]
      }
    ];

    expect(() => validateMilestoneDependencies(milestones)).toThrow(
      'Milestone "intro_complete" cannot depend on itself.'
    );
  });

  it("throws on duplicate order values", () => {
    const milestones: Milestone[] = [
      { id: "intro_complete", order: 1 },
      { id: "training_started", order: 1 }
    ];

    expect(() => validateMilestoneOrdering(milestones)).toThrow(
      'Milestone order 1 is duplicated by "intro_complete" and "training_started".'
    );
  });

  it("keeps original array order when order is missing", () => {
    const milestones: Milestone[] = [
      { id: "third" },
      { id: "first", order: 1 },
      { id: "second" }
    ];

    expect(getOrderedMilestones(milestones).map((milestone) => milestone.id)).toEqual([
      "first",
      "third",
      "second"
    ]);
  });

  it("throws when dependency ordering is invalid", () => {
    const milestones: Milestone[] = [
      { id: "intro_complete", order: 2 },
      { id: "training_started", order: 1, dependsOn: ["intro_complete"] }
    ];

    expect(() => validateMilestoneOrdering(milestones)).toThrow(
      'Milestone "training_started" has order 1 but depends on "intro_complete" with order 2.'
    );
  });
});
