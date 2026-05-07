# Data Layer

This folder owns content loading boundaries:
- JSON loaders via HttpClient from assets/data
- Dialogue definition lookup via assets/data/dialogues.json
- Dialogue file loading from assets/dialogue
- Dialogue project manifests via assets/data/dialogue-project.json
- Zod parse/validation at load boundaries

Runtime game data is read-only and data-driven.
