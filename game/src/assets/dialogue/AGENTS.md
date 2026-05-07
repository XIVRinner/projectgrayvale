# Dialogue Asset Rules

- Treat everything under this folder as one ValeFlow project. Every `.fsc` file listed in [dialogue-project.json](../data/dialogue-project.json) loads together before a session starts.
- Update [dialogue-project.json](../data/dialogue-project.json) whenever you add, rename, move, or delete a dialogue file. Missing entries will not be visible to the runtime.
- Update [dialogues.json](../data/dialogues.json) whenever you add, rename, or retarget a game-triggerable dialogue id. Action-layer dialogue ids resolve through that registry before the project starts.
- Put shared actors, shared flags, and other cross-file state in [globals.fsc](./globals.fsc) using `declare global`.
- Keep file-local `declare` statements for state that should reset within that one script only.
- Use project-relative filenames for cross-file targets, for example `goto arkama/bridgitte-repetables.fsc::BRIDGITTE_REPEATABLE_TALK`.
