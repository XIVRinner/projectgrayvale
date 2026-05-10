# Data Layer

This folder owns content loading boundaries:
- Collection-style game data via the Express API at /api/*
- Document-style fallback resources via /api/data/*
- A separate API content cache for hot reads, independent from save-slot persistence
- Dialogue definition lookup via /api/dialogues
- Dialogue file loading from assets/dialogue
- Dialogue project manifests via /api/data/dialogue-project
- Zod parse/validation at load boundaries

Runtime game data is read-only and data-driven.
