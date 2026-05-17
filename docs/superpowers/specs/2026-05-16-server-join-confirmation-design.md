# Server Join Confirmation and Server Select Refresh Design

## Context

The shell server selection UI needs a safety pass for newly created characters. Joining a server can allow the server to apply compatibility state to a character. The player must explicitly confirm before any character join/register data is sent.

Affected area: `game/src/app/layout/shell/sub-pieces/shell-server-select-modal.*` and shell wiring around character creation.

## Goals

- Always confirm server join after a new character is created.
- Send no player UUID, password, or character data to a server before confirmation.
- Let the player choose one of three paths: join current server, choose another server, or stay offline.
- Refresh Server Select into a desktop-first server list with selected-server details.
- Keep current implementation grounded in existing data. Do not invent future server info shapes.

## Non-goals

- No backend changes.
- No new `/serverinfo` contract yet.
- No full offline-mode mechanics.
- No mobile layout design pass.
- No broad server type filtering unless backed by current data.

## UX Flow

### After character creation

1. Character creation completes locally.
2. Shell opens a dedicated **Join Server Confirmation** dialog.
3. The app does not call `connectPlayer`, register, join, or send character data before the player chooses an action.
4. The player chooses:
   - **Join current server**: proceed using the current selected/connected server context. For a same-server character change, first restore the existing cookie session. If the cookie is valid and not expired, no password is required; then register the new local character and mark it active.
   - **Choose another server**: close confirmation and open Server Select. If the new server requires auth, prompt for password there.
   - **Stay offline**: close confirmation and leave the character local. Offline mode remains undefined beyond this UI path.

### Warning tone

If current profile data indicates custom/modded content, show a yellow warning:

> You are about to join a modded server.

Supporting copy should be short and deliberate. The prompt should feel like a safety checkpoint, not a scare screen.

If server profile data is unavailable, show the selected endpoint and cautious neutral copy. Do not fetch new server info just to render this screen unless the existing app already has it.

## Components

### New `shell-server-join-confirmation`

Location:

- `game/src/app/layout/shell/sub-pieces/shell-server-join-confirmation.component.ts`
- `game/src/app/layout/shell/sub-pieces/shell-server-join-confirmation.component.html`
- `game/src/app/layout/shell/sub-pieces/shell-server-join-confirmation.component.scss`

Type: dumb presentational component.

Inputs:

- `open`
- selected `ServerDirectoryEntry | null`
- `ServerProfile | null`
- active player UUID/name context if already available

Outputs:

- `joinCurrentServerRequested`
- `chooseDifferentServerRequested`
- `stayOfflineRequested`
- `closed`

UI structure:

- `gv-dialog-shell`
- Title: `Join server?`
- Selected server identity block: label, host, port
- Yellow warning band if known modded/custom
- Short risk copy
- Actions: primary Join current server, secondary Choose another server, quiet Stay offline

Implementation note:

```ts
// GAP: Server dirty/modded public info
// Blocked on: server API design
// Needs: public /serverinfo endpoint exposing server flags such as modded, private, official, official modded, and dirty-risk messaging.
// Do not implement until: the /serverinfo response shape is defined and wired into the server directory/profile layer.
```

### Refreshed `shell-server-select-modal`

Keep one top-level Server Select component. Do not create a duplicate selector.

Layout: desktop-first two-column utility screen.

Left rail:

- Search field filtering by server label, host, and port.
- Server row/tile list.
- Each row shows label and endpoint.
- Client ID is not shown in the main list.
- Active selected server has a clear selected state.
- Badges are allowed only where backed by current data. For now, custom/modded state can only be known for the current fetched profile, not every listed server.

Right panel:

- Selected server details.
- Current profile badge if known: Official or Custom/Modded.
- Connect player UUID/password form for manual connection.
- Add server form as a secondary section.
- Admin rights section lower priority than normal connect actions.

Filtering:

- Implement search now.
- Do not implement Official/Modded/Private filters until `/serverinfo` exists for listed servers.

## State and Data Flow

- `ShellContainerComponent` owns confirmation open/closed state.
- `ShellViewComponent` receives confirmation inputs and forwards outputs.
- `ShellServerJoinConfirmationComponent` is presentation-only.
- `ServerConnectionService.connectPlayer(...)` remains the password-based profile join path.
- `ServerConnectionService.restoreSessionFromCookie()` is allowed only after confirmation for the same selected server. Expired or missing cookies fall back to Server Select with a password prompt.
- Character creation must not trigger server join side effects before confirmation.

## Styling

- Use existing theme tokens only.
- If a dedicated warning token is needed, add it to `src/app/shared/theme/_tokens.scss` before use.
- No inline styles.
- Avoid side-stripe warning treatments. Use full border, background tint, icon/label, or compact warning block.
- Product register: restrained, task-first, familiar controls.

Physical scene: a player finishes character creation at a desktop game client, sees they are still connected to a server, and needs a clear safety checkpoint before that character touches server state.

## Tests

- Confirmation component emits the correct output for each action.
- Character creation opens confirmation instead of directly connecting to a server.
- Choosing another server opens Server Select.
- Staying offline closes confirmation and makes no server connection call.
- Server Select search filters by label/host/port.
- Do not mock future `/serverinfo` fields.

## Acceptance Criteria

- New character creation always presents confirmation before server join.
- Same-server character change may use a valid cookie session after confirmation, without requiring password re-entry.
- Expired or missing cookies open Server Select with clear manual-auth copy.
- No server join/register character data is sent before confirmation.
- Confirmation has three explicit choices.
- Server Select uses a left server list and right details panel.
- Client ID is absent from the primary list but still available where required for adding servers.
- Future server classification is documented as a `GAP:` rather than invented.
