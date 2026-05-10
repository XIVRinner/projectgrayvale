import { expect, test } from "@playwright/test";
import { samplePlayer } from "@rinner/grayvale-core";

test("app shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});

test("world actions persist world state and button interaction deltas", async ({ page }) => {
  await page.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, payload);
    },
    {
      key: "grayvale:save-slots:v1",
      payload: buildRosterPayload()
    }
  );

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Leave chief house" })).toBeVisible();
  await page.getByRole("button", { name: "Leave chief house" }).click();

  await expect(page.getByRole("button", { name: "Enter tavern" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Travel to Camp" })).toBeVisible();
  await page.getByRole("button", { name: "Enter tavern" }).click();

  await expect(page.getByRole("button", { name: "Leave tavern" })).toBeVisible();
  await page.getByRole("button", { name: "Leave tavern" }).click();
  await page.getByRole("button", { name: "Travel to Camp" }).click();

  await expect(page.getByRole("button", { name: "Travel to Arkama Village" })).toBeVisible();
  await page.getByRole("button", { name: "Travel to Arkama Village" }).click();

  const persistedRoster = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("grayvale:save-slots:v1") ?? "null")
  );

  expect(persistedRoster?.slots?.[0]?.world).toEqual({
    currentLocation: "village-arkama",
    sublocations: []
  });
  expect(persistedRoster?.slots?.[0]?.player?.interactionState?.totalButtonPresses).toBe(5);
  expect(
    persistedRoster?.slots?.[0]?.player?.interactionState?.lastButtonPress
  ).toMatchObject({
    actionId: "travel-camp-to-village-arkama",
    actionKind: "world-travel",
    locationId: "camp",
    payload: {
      fromLocationId: "camp",
      targetLocationId: "village-arkama"
    }
  });
});

test("coyote encounter runs through the combat presentation layer", async ({ page }) => {
  await page.addInitScript(
    ({ key, payload }) => {
      window.localStorage.setItem(key, payload);
    },
    {
      key: "grayvale:save-slots:v1",
      payload: buildCombatRosterPayload()
    }
  );

  await page.goto("/");

  await expect(page.getByRole("button", { name: "Cull the Coyote" })).toBeVisible();
  await page.getByRole("button", { name: "Cull the Coyote" }).click();

  const combatDialog = page.getByRole("dialog", { name: "Cull the Coyote" });
  await expect(combatDialog).toBeVisible();
  await expect(combatDialog.getByRole("heading", { level: 1, name: "Cull the Coyote" })).toBeVisible();
  await expect(combatDialog.getByText("Compiled Rotation")).toBeVisible();

  await expect(page.locator(".gv-combat__outcome")).toBeVisible({ timeout: 15000 });

  const persistedRoster = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("grayvale:save-slots:v1") ?? "null")
  );
  const player = persistedRoster?.slots?.[0]?.player;

  expect(player?.attributes?.agility).toBeGreaterThan(10);
  expect(player?.progression?.experience).toBeGreaterThan(145);
  expect(player?.skills?.short_blade).toBeGreaterThan(2);
  expect(player?.questLog?.quests?.cull_arkama_coyote).toMatchObject({
    currentStep: "cull_the_coyote",
    status: "completed"
  });
  expect(player?.activityState?.activeActivityId).toBeNull();
});

function buildRosterPayload(): string {
  const player = cloneValue(samplePlayer);
  delete player.interactionState;

  return JSON.stringify({
    activeSlotId: "slot_1",
    slots: [
      {
        id: "slot_1",
        createdAt: "2026-05-01T08:00:00.000Z",
        updatedAt: "2026-05-01T08:00:00.000Z",
        player,
        world: {
          currentLocation: "village-arkama",
          sublocations: ["chief-house"]
        }
      }
    ]
  });
}

function buildCombatRosterPayload(): string {
  const player = cloneValue(samplePlayer);

  player.questLog = {
    quests: {
      ...player.questLog?.quests,
      cull_arkama_coyote: {
        currentStep: "cull_the_coyote",
        status: "active",
        completedSteps: []
      }
    }
  };
  player.activityState = {
    availability: {
      ...player.activityState?.availability,
      coyote_culling: {
        status: "enabled"
      }
    },
    activeActivityId: null
  };
  delete player.interactionState;

  return JSON.stringify({
    activeSlotId: "slot_1",
    slots: [
      {
        id: "slot_1",
        createdAt: "2026-05-01T08:00:00.000Z",
        updatedAt: "2026-05-01T08:00:00.000Z",
        player,
        world: {
          currentLocation: "forest_edge",
          sublocations: []
        }
      }
    ]
  });
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
