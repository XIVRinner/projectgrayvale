# Gray Vale Player Identity Context

This context defines player-facing identity terms for server-connected profile management in ProjectGrayVale.
It exists to keep profile, character, and session language consistent across game and server discussions.

## Language

**Server Profile Page**:
The connected profile management screen that shows account-level profile data and all server-backed characters.
_Avoid_: Character sheet, local profile, save manager

**Profile**:
The account-level identity keyed by profileId that owns multiple characters.
_Avoid_: Player UUID, character, account token

**Server Access Registration**:
The first-time server auth registration that creates server access for a Profile.
_Avoid_: Pair registration, login, character registration

**Character Pair Registration**:
The server operation that records or refreshes the active Character/Profile pair and its latest snapshot.
_Avoid_: Account registration, allow-list registration, profile creation

**Character Pair Registration Triggers**:
Character Pair Registration runs after join, cookie-session restore, and active-character changes, but not on heartbeat ticks.
_Avoid_: Tick sync, continuous registration

**Cookie Restore Character Authority**:
On cookie-session restore, the server session's activeCharacterId is the authoritative Character for Character Pair Registration.
_Avoid_: Local-save authority during restore, silent character reselection

**Restore Snapshot Rule**:
Cookie-session restore always reaffirms the Profile/Character pair, but only sends level and location when the matching local Character is loaded.
_Avoid_: Guessed restore snapshots, mandatory restore snapshot overwrite

**Server-Scoped Character Ownership**:
Character ownership is enforced within a server's roster, so an unregistered Character UUID on the current server may be paired even if it was used under a different Profile on another server.
_Avoid_: Global ownership assumption, cross-server ownership lock

**Same-Server Character Collision Rule**:
If a server already knows a Character UUID under one Profile, Character Pair Registration on that same server must reject attempts to pair it to a different Profile.
_Avoid_: Silent same-server reassignment, accidental roster takeover

**Client-Origin Character Creation**:
Characters are created in the client save system first, even while connected to a server.
_Avoid_: Server-owned character creation, profile-page character authoring

**Server Character Registration**:
After a client creates a Character, the client must send that Character's identity and snapshot to the server before it can appear in server-backed profile surfaces.
_Avoid_: Implicit server-side invention, profile-only creation, nonexistent server character assumption

**Dedicated Server Character Registration**:
Server Character Registration is a distinct operation from server-side character creation and from Character Pair Registration.
_Avoid_: Overloaded registration flow, merged character-create-and-register semantics

**Idempotent Server Character Registration**:
Repeated Server Character Registration for the same Profile and Character on the same server is treated as a safe refresh, not a duplicate-create error.
_Avoid_: Retry-as-conflict behavior, duplicate registration failure for the same server character

**Registration Sequence**:
For a Character unknown to the current server, Server Character Registration happens before Character Pair Registration.
_Avoid_: Pair-first registration, assuming server character existence

**Server Connection Consent**:
If no current server connection exists, the player must explicitly confirm that they want to connect to the target server before server entry or registration begins.
_Avoid_: Silent server entry, implicit first connect, background registration before consent

**Connected Character Switch Server Prompt**:
When a different local Character is loaded while a server connection exists, the client reopens the server-select window and requires explicit server join confirmation for that loaded Character.
_Avoid_: Inline auto-join prompts, silent re-registration on local character load

**Connected Character Switch Disconnect Rule**:
When a different local Character becomes loaded during an active server session, the current server session is disconnected immediately before the server-select window reopens.
_Avoid_: Split local-vs-server active character state, stale server session after local character swap

**Server Profile Character Scope**:
The `Your Profile -> Characters` tab shows only Characters known to the currently connected server.
_Avoid_: Merged local-plus-server roster, local-only character leakage into server profile

**Server Profile Character Visibility**:
The `Your Profile -> Characters` tab shows all Characters known to the current server for the Profile, even when this device lacks the matching local save.
_Avoid_: Device-dependent roster hiding, local-save-only visibility

**Server Profile Character Authoring Boundary**:
The relay `Your Profile` surface does not create Characters; character creation belongs to the client-side save and character-creator flow.
_Avoid_: Server-profile character authoring, profile-page new-character creation

**Server Profile Character Cleanup**:
The relay `Your Profile -> Characters` roster allows removing server-known Characters from the current server profile.
_Avoid_: Read-only server roster, cleanup blocked by visibility state

**Local Character Selection Authority**:
The local character selection and save-slot flow is the only place that may change which Character is loaded for play.
_Avoid_: Relay-profile character activation, server-roster-driven local loading

**Relay Profile Character Activation Boundary**:
The relay `Your Profile -> Characters` roster is read-only for activation and may only display which Character is active on the current server.
_Avoid_: Relay-profile select buttons, server-roster-driven local character loading

**Current Server Character Deletion Scope**:
Removing a Character from the relay profile deletes only the current server's roster entry and does not delete the local save on this device.
_Avoid_: Cross-scope deletion, implicit local save removal

**Server Character Re-Registration**:
A local Character remains available for later reconnect and server registration after its current server roster entry is removed.
_Avoid_: Server-delete-as-character-destruction, one-way server cleanup

**Active Character Delete Block**:
The currently active server Character cannot be removed until the player switches to a different Character.
_Avoid_: Active-character deletion, mid-session roster teardown

**Active Character Delete Block Message**:
The canonical player-facing message for `active_character_delete_blocked` is `Switch to a different character before removing this one from the server profile.`
_Avoid_: Vague blocked-delete copy, internal session jargon

**Unavailable Character State**:
A server-known Character may stay visible but disabled for entry when this device cannot currently enter it.
_Avoid_: Click-through without readiness, hidden unavailable characters

**Unavailable Character Reason**:
An unavailable Character must show the specific reason entry is blocked, such as missing local save data or server incompatibility.
_Avoid_: One-size-fits-all blocked message, silent disabled state

**Unavailable Character Reason Category**:
Unavailable Character reasons use explicit categories, starting with `missing_local_save`, `server_incompatible`, and `character_tamper_detected`.
_Avoid_: Free-text-only availability rules, unstable blocked-state semantics

**Server Incompatible Character Message**:
The canonical player-facing message for `server_incompatible` is `This character is not compatible with the current server.`
_Avoid_: Over-specific incompatibility copy, implementation-detail error text

**Character Tamper Detected Message**:
The canonical player-facing message for `character_tamper_detected` is `This character's data could not be verified on this server.`
_Avoid_: Accusatory anti-cheat copy, leaked verification details

**Active Character Registration Missing**:
When a restored session points to a Character the current server roster no longer recognizes for that Profile, the relay profile enters a repair state instead of silently repairing it.
_Avoid_: Silent restore repair, forced session destruction, fake active-character continuity

**Active Character Registration Missing Message**:
The canonical player-facing message for `active_character_registration_missing` is `This server could not restore your active character. Select a character to continue.`
_Avoid_: Internal registration jargon, unclear recovery guidance

**Repair-State Cleanup Delete**:
Removing the broken server roster Character also clears the `active_character_registration_missing` repair state.
_Avoid_: Stale repair warnings after intentional cleanup, lingering broken-reference state

**Repair-State Recovery Navigation**:
After delete clears the repair state, the client reopens the server-profile character selection view so the player can choose the next valid Character.
_Avoid_: Silent recovery completion, forcing the player to hunt for the roster view

**Registration Name Source**:
First-time Character Pair Registration for an unknown Character UUID must include Character Name, while later refresh registrations may omit it.
_Avoid_: Placeholder names, guessed names, mandatory repeat name sync

**Character Name Immutability**:
After first successful server registration, a Character's registered name stays immutable and later mismatches are treated as tamper evidence.
_Avoid_: Rename-through-registration, mutable registered identity, silent name drift

**Character Name Mismatch Handling**:
If a registered Character reappears with a different name, the server rejects entry for that Character on that server and records low-severity tamper evidence without auto-banning the Profile.
_Avoid_: Silent acceptance of name mismatch, auto-ban escalation for low-level tamper evidence

**Registration Portrait Source**:
First-time Character Pair Registration for an unknown Character UUID must include Character Portrait Shard ID, while later refresh registrations may omit it.
_Avoid_: Missing first-card portraits, guessed portrait fallbacks, mandatory repeat portrait sync

**Registration Location Fields**:
Character Pair Registration sends both locationId and lastLocationName for snapshot updates.
_Avoid_: ID-only location snapshots, server-derived-only location labels

**Registration Snapshot Merge Rule**:
Character Pair Registration updates only snapshot fields that are present and valid, and omission keeps the stored value unchanged.
_Avoid_: Blank-overwrite semantics, mandatory full snapshot replacement

**Registration Response Shape**:
Successful Character Pair Registration returns the updated Character summary and whether the server created or refreshed that roster entry.
_Avoid_: Ack-only registration, opaque mutation results

**Character**:
A playable identity owned by exactly one profile and selected into a server session.
_Avoid_: Profile, account

**Authoritative Character Snapshot**:
Card data shown on the Server Profile Page must come only from server-backed profile APIs, with no local-save fallback.
_Avoid_: Guessed profile card, merged local/server card

**Character Name**:
The canonical display name field for profile characters is `name` in the server summary contract.
_Avoid_: characterName

**Profile Rename**:
Profile display name changes are edited inline on the Server Profile Page and persisted only when the user explicitly saves.
_Avoid_: Auto-save rename, local-only rename

**Profile Name Validation**:
Profile rename input is trimmed and must be 1-80 characters after trim; empty values are rejected.
_Avoid_: Empty display names, stricter ad hoc charset rules

**Character Portrait**:
Each character has an immutable portrait selected at character creation and represented by a shared shard asset reference.
_Avoid_: Mutable character avatar, profile avatar as character portrait

**Character Portrait Shard ID**:
The profile API exposes immutable character portrait identity as `portraitShardId`, not a hosted URL/path.
_Avoid_: portraitIcon, portraitUrl

**Profile Avatar**:
Profile avatar is account-level, mutable, and independent from character portraits.
_Avoid_: Character portrait, immutable profile image

**Live Character Snapshot**:
Character level and last location are live values that update over time and are returned by profile APIs as the latest known server snapshot.
_Avoid_: Creation-time level, static location snapshot

**Snapshot Refresh Events**:
Live character snapshots are persisted on character connect/load, location change, level-up, and disconnect/logout.
_Avoid_: Continuous write-on-every-tick persistence

**Character Last Location Fields**:
Profile summaries return both `locationId` and `lastLocationName` for each character snapshot.
_Avoid_: Name-only location data, ID-only location data

**Unknown Snapshot Display**:
When a live snapshot value is unavailable, cards show "Unknown" for level/location and use a neutral silhouette only if `portraitShardId` is missing unexpectedly.
_Avoid_: Guessed placeholder values

**Profile Update Endpoint**:
Profile edits persist through `PATCH /api/player/profile` with request body `{ displayName }`.
_Avoid_: POST rename-only endpoint

**Profile Update Response**:
Successful profile updates return the full updated profile summary shape used by profile reads.
_Avoid_: Minimal ack-only response

**Character Card Ordering**:
Server Profile Page cards order as active character first, then by `lastPlayedAt` descending, with creation order ascending as the tie-breaker.
_Avoid_: Unstable ordering, alphabetical-only ordering

**Incompatible Character Visibility**:
Characters incompatible with the current server remain visible as disabled cards with explicit incompatibility reasons.
_Avoid_: Hiding incompatible characters

**Profile Display Name Consistency**:
Profile rename updates both `player_profiles.display_name` and `allowed_players.display_name` in one server-side operation.
_Avoid_: Single-table updates that drift identity views

**Snapshot Backfill Strategy**:
Existing characters receive a one-time best-effort backfill for new snapshot fields, then ongoing updates follow snapshot refresh events.
_Avoid_: Permanent null legacy snapshots, repeated migration rewrites

**Backfill Data Source Rule**:
One-time backfill parses existing saved character payloads when available, and uses Unknown only when source data is absent or invalid.
_Avoid_: Skipping available save payload data

**Profile Identity Labeling**:
User-facing profile surfaces show Profile UUID only and do not display Player UUID.
_Avoid_: Dual UUID display in profile UI

**Relay Profile Unification**:
The World Server Relay "Your Profile" menu renders the canonical Server Profile Page behavior and removes relay-specific duplicate profile cards.
_Avoid_: Parallel profile UIs

**Notification Event**:
A domain-level signal that something player-relevant happened and may be routed to one or more delivery channels.
_Avoid_: Toast-only event semantics

**Delivery Policy**:
The routing rule that decides whether a notification event is client-only, server-only, or client-and-server.
_Avoid_: Treating routing policy as event origin

**Toast**:
An in-session UI delivery channel for immediate notification display while the player is online in the client.
_Avoid_: Persisted offline inbox behavior

**System Chat Message**:
A chat-channel delivery for notable game events intended to be visible to other players in shared spaces.
_Avoid_: Using toast as the only multiplayer notification channel

**Notification Backlog**:
A persisted store of notification events delivered after reconnect for things that happened while the player was offline.
_Avoid_: Treating backlog delivery as toast-only behavior

**Notification Channel Mapping**:
A per-event rule that chooses delivery channels such as toast, system chat message, or silent handling.
_Avoid_: Global one-channel-for-all notification behavior

**Local Notification Finality**:
Client-visible notification outcomes are final once shown locally and are not revoked if downstream server broadcast fails.
_Avoid_: Toast rollback or take-back behavior

**Notification Policy Catalog**:
A declarative data configuration that defines delivery policy and channel mapping per notification event type.
_Avoid_: Hardcoded service branching as the source of truth

**Notification Audience**:
The target player scope for a broadcast notification, such as local scope or global scope.
_Avoid_: Implicit audience defaults hidden in transport code

**Statistic**:
A raw tracked gameplay fact or counter used as input for progression and achievement evaluation.
_Avoid_: Embedding achievement semantics directly in activity events

**Atomic Gameplay Fact**:
A single immutable gameplay occurrence emitted as source input for statistics aggregation.
_Avoid_: Feature-specific pre-aggregated counter mutations as source events

**Statistics Idempotency**:
The rule that each atomic gameplay fact is processed once using a stable idempotency identity.
_Avoid_: Double-counting from retries or duplicate deliveries

**Achievement**:
A milestone rule that is evaluated from statistics and can be earned once per declared scope when its criteria are met.
_Avoid_: Re-earning the same milestone repeatedly within one scope

**Achievement Scope**:
The ownership boundary for an achievement, either profile-bound or character-bound.
_Avoid_: Implicit or mixed ownership without an explicit scope

**Milestone Crossing Emission**:
When a statistic jump satisfies multiple new achievement thresholds, all newly crossed milestones are emitted in ascending order.
_Avoid_: Emitting only the highest crossed threshold

**Domain Emit vs Transport Publish**:
Domain logic emits notification events while infrastructure publishes transport messages.
_Avoid_: Treating emit and publish as interchangeable domain terms

## Relationships

- A **Profile** owns zero or more **Characters**
- A **Server Access Registration** creates server access for one **Profile**
- A **Character Pair Registration** associates one active **Character** with one **Profile**
- **Character Pair Registration Triggers** determine when the active **Character/Profile** association is refreshed
- **Cookie Restore Character Authority** decides which **Character** a restored server session reaffirms
- The **Restore Snapshot Rule** limits which live fields a restore may refresh for a **Character**
- **Server-Scoped Character Ownership** defines where a **Character/Profile** claim is enforced
- The **Same-Server Character Collision Rule** decides what happens when a known **Character** is claimed by a different **Profile** on the same server
- **Client-Origin Character Creation** defines where a new **Character** begins its life
- **Server Character Registration** defines how a client-created **Character** becomes known to a server roster
- **Dedicated Server Character Registration** keeps server character existence separate from other registration flows
- **Idempotent Server Character Registration** defines how retries behave for a known server character
- **Registration Sequence** defines the order between server character existence and active pairing
- **Server Connection Consent** gates when server entry and registration are allowed to start
- **Connected Character Switch Server Prompt** defines how the client asks for consent after loading a different local Character during an active server session
- **Server Profile Character Scope** defines which Characters may appear in the relay profile roster
- **Server Profile Character Visibility** defines whether server-known Characters remain visible without local saves
- **Server Profile Character Authoring Boundary** defines where Character creation is allowed to happen
- **Server Profile Character Cleanup** defines whether the relay roster supports removing server-known Characters
- **Local Character Selection Authority** defines which UI is allowed to load or switch the playable Character
- **Current Server Character Deletion Scope** defines what a relay-profile delete actually removes
- **Server Character Re-Registration** defines what remains possible after current-server roster cleanup
- **Active Character Delete Block** defines when roster cleanup is temporarily disallowed
- **Active Character Delete Block Message** defines the player-facing copy for that blocked-delete state
- **Unavailable Character State** defines when a visible server-known **Character** is disabled for entry
- **Unavailable Character Reason** defines how the relay profile explains why a visible **Character** cannot be entered
- **Unavailable Character Reason Category** defines the stable blocked-state categories behind those explanations
- **Server Incompatible Character Message** defines the base player-facing copy for server incompatibility
- **Character Tamper Detected Message** defines the base player-facing copy for tamper-based entry blocks
- **Active Character Registration Missing** defines the relay repair state for a restored session whose active character is no longer registered
- **Active Character Registration Missing Message** defines the recovery copy for that repair state
- **Repair-State Cleanup Delete** defines how intentional cleanup resolves the broken restored-character reference
- **Repair-State Recovery Navigation** defines where the client takes the player after that cleanup
- **Registration Name Source** defines how a new server roster **Character** gets its required display name
- **Character Name Immutability** defines how a registered **Character** name behaves after first server registration
- **Character Name Mismatch Handling** defines what the server does with later immutable-name mismatches
- **Registration Portrait Source** defines how a new server roster **Character** gets its initial portrait identity
- **Registration Location Fields** define how a **Character** snapshot carries player-facing location data
- **Registration Snapshot Merge Rule** defines how repeated registrations refresh a **Character** snapshot safely
- **Registration Response Shape** defines what the client learns immediately after a roster registration
- A **Server Profile Page** displays one **Profile** and all owned **Characters**
- A **Server Profile Page** renders each **Character** from an **Authoritative Character Snapshot**
- A **Character Portrait** is immutable per **Character** and separate from **Profile Avatar**
- A **Live Character Snapshot** updates over time for each **Character**
- **Snapshot Refresh Events** define when each **Live Character Snapshot** is persisted

## Example dialogue

> **Dev:** "Should this card list come from the local save roster or the **Profile**?"
> **Domain expert:** "From the **Profile**; the **Server Profile Page** must show all server-owned **Characters**."

## Flagged ambiguities

- "profile page" was ambiguous between local character sheet and server UI; resolved: use **Server Profile Page** for this feature.
- "character card data source" was ambiguous between local save and server summary; resolved: use **Authoritative Character Snapshot** only.
- "character name field" was ambiguous between `name` and `characterName`; resolved: use **Character Name** as `name`.
- "profile rename interaction" was ambiguous between auto-save and explicit save; resolved: use **Profile Rename** with explicit save to a dedicated endpoint.
- "profile rename validation" was unspecified; resolved: use **Profile Name Validation** with trim plus 1-80 length.
- "portrait source" was ambiguous between account avatar and character portrait; resolved: use immutable **Character Portrait** and separate mutable **Profile Avatar**.
- "portrait field shape" was ambiguous between hosted path and shard identity; resolved: expose **Character Portrait Shard ID** as `portraitShardId`.
- "level/location semantics" were ambiguous between static and dynamic; resolved: use **Live Character Snapshot** values in profile API responses.
- "snapshot write timing" was unspecified; resolved: use **Snapshot Refresh Events** at connect, location change, level-up, and disconnect.
- "location field shape" was ambiguous between ID-only and denormalized name; resolved: expose **Character Last Location Fields** with both `locationId` and `lastLocationName`.
- "missing snapshot rendering" was unspecified; resolved: use **Unknown Snapshot Display** with Unknown labels and silhouette only for missing `portraitShardId`.
- "profile write endpoint shape" was ambiguous between resource patch and rename action; resolved: use **Profile Update Endpoint** as `PATCH /api/player/profile`.
- "profile update response shape" was ambiguous between ack and full resource; resolved: use **Profile Update Response** with full summary payload.
- "character card ordering" was unspecified; resolved: use **Character Card Ordering** with active-first then recency.
- "incompatible character rendering" was ambiguous between hide vs show-disabled; resolved: use **Incompatible Character Visibility** with disabled cards and reasons.
- "display name source of truth" was ambiguous across profile and auth/social tables; resolved: use **Profile Display Name Consistency** with one dual-write update.
- "legacy snapshot migration" was ambiguous between lazy-only and migration; resolved: use **Snapshot Backfill Strategy** as one-time best-effort plus live refresh updates.
- "backfill data source" was ambiguous between parse and null-default; resolved: use **Backfill Data Source Rule** with best-effort parse and Unknown fallback.
- "profile identity labels" were ambiguous between profile and player UUID display; resolved: use **Profile Identity Labeling** with Profile UUID only.
- "relay profile implementation" was ambiguous between custom relay cards and canonical page behavior; resolved: use **Relay Profile Unification**.
- "register" was ambiguous between creating server auth access and refreshing the active profile-character relationship; resolved: use **Server Access Registration** for the former and **Character Pair Registration** for the latter.
- "notification" was ambiguous between domain signal and UI rendering; resolved: use **Notification Event** for the signal and **Toast** for online in-session display, with **Notification Backlog** for offline catch-up delivery.
- "local/server/combined" was ambiguous between source and routing; resolved: use **Delivery Policy** (client-only, server-only, client-and-server) as the canonical model.
- "combined notification failure" was ambiguous on player-facing behavior; resolved: use **Local Notification Finality** so local toasts remain even when server broadcast fails.
- "achievement vs stats" was ambiguous between counters and milestones; resolved: use **Statistic** as raw facts and **Achievement** as one-time rule outcomes derived from those facts.
- "achievement ownership" was ambiguous between account and character progression; resolved: use **Achievement Scope** with explicit profile-bound or character-bound ownership per achievement.
- "server notification display" was ambiguous between forced toast and per-event routing; resolved: use **Notification Channel Mapping** per event.
- "where notification routing rules live" was ambiguous between code and config; resolved: use a declarative **Notification Policy Catalog**.
- "statistics source shape" was ambiguous between raw facts and pre-aggregates; resolved: use **Atomic Gameplay Fact** as canonical source input.
- "statistics retry behavior" was ambiguous under duplicate delivery; resolved: enforce **Statistics Idempotency**.
- "milestone jump handling" was ambiguous between single and full unlock; resolved: use **Milestone Crossing Emission** for all crossed thresholds in order.
- "broadcast target scope" was ambiguous between one default and explicit targeting; resolved: include **Notification Audience** in notification policy.
- "emit vs publish" was ambiguous across domain and infrastructure language; resolved: use **Domain Emit vs Transport Publish** terminology.
- "when registration runs" was unspecified; resolved: use **Character Pair Registration Triggers** after join, cookie restore, and active-character changes, not per tick.
- "which character wins on cookie restore" was ambiguous between local active save and restored session state; resolved: use **Cookie Restore Character Authority** with server session `activeCharacterId`.
- "what restore can update" was ambiguous between always overwriting and partial reaffirmation; resolved: use **Restore Snapshot Rule** with optional level/location refresh only when the matching local Character is loaded.
- "what first sight may claim" was ambiguous between global ownership and server-local ownership; resolved: use **Server-Scoped Character Ownership** so pairing is enforced per server roster, not across servers.
- "what happens on same-server UUID conflict" was ambiguous between reassignment and rejection; resolved: use **Same-Server Character Collision Rule** with rejection on the current server.
- "how a new server character appears" was ambiguous between server-side creation and client-origin creation; resolved: use **Client-Origin Character Creation** plus **Server Character Registration** after client creation.
- "whether server character registration reuses another flow" was ambiguous between a dedicated operation and overloaded existing routes; resolved: use **Dedicated Server Character Registration** as a separate operation.
- "how repeated server character registration behaves" was ambiguous between safe retry and duplicate conflict; resolved: use **Idempotent Server Character Registration** as a safe refresh for the same Profile and Character on one server.
- "which registration happens first" was ambiguous between pairing and server-character creation; resolved: use **Registration Sequence** with server character registration before pair registration.
- "when connection may begin" was ambiguous between automatic entry and explicit consent; resolved: use **Server Connection Consent** before server entry or registration starts.
- "how to handle a loaded local character while already connected" was ambiguous between inline prompts and explicit server-select re-entry; resolved: use **Connected Character Switch Server Prompt** with the server-select window and explicit join confirmation.
- "`Your Profile -> Characters` scope" was ambiguous between server-only and merged local/server rosters; resolved: use **Server Profile Character Scope** with server-known Characters only.
- "`Your Profile -> Characters` visibility" was ambiguous between cross-device roster visibility and local-only visibility; resolved: use **Server Profile Character Visibility** with all server-known Characters shown even without local saves on this device.
- "who is allowed to create characters" was ambiguous between relay profile UI and the local client flow; resolved: use **Server Profile Character Authoring Boundary** with client-side character creation only.
- "whether the relay roster supports cleanup" was ambiguous between read-only and manageable roster behavior; resolved: use **Server Profile Character Cleanup** with server-roster removal allowed.
- "who is allowed to load or switch characters" was ambiguous between relay profile cards and the save-slot selector; resolved: use **Local Character Selection Authority** with local character selection as the only activation surface.
- "what server-profile delete removes" was ambiguous between server roster cleanup and local save deletion; resolved: use **Current Server Character Deletion Scope** with current-server-roster removal only.
- "what happens to a local save after server-roster cleanup" was ambiguous between destruction and reuse; resolved: use **Server Character Re-Registration** so the local Character may later reconnect and register again.
- "whether the active character can be deleted" was ambiguous between blocked and forced-switch behavior; resolved: use **Active Character Delete Block** with the message `Switch to a different character before removing this one from the server profile.`
- "how to treat a server-known character without a local save" was ambiguous between selectable and disabled states; resolved: use **Unavailable Character State** with visible-but-disabled behavior.
- "why a disabled character is unavailable" was ambiguous because missing local save is not the only cause; resolved: use **Unavailable Character Reason** with specific blocked reasons such as missing local save data or server incompatibility.
- "how unavailable reasons are represented" was ambiguous between raw text and stable categories; resolved: use **Unavailable Character Reason Category** with at least `missing_local_save` and `server_incompatible`.
- "how to phrase server incompatibility" was ambiguous between broad and over-specific wording; resolved: use **Server Incompatible Character Message** as `This character is not compatible with the current server.`
- "how to phrase tamper-based entry rejection" was ambiguous between accusatory and neutral wording; resolved: use **Character Tamper Detected Message** as `This character's data could not be verified on this server.`
- "how to recover from a restored active-character registration gap" was ambiguous between silent repair and explicit recovery; resolved: use **Active Character Registration Missing** with a repair state and the message `This server could not restore your active character. Select a character to continue.`
- "what cleanup does to the active-character repair state" was ambiguous between stale warning retention and resolution; resolved: use **Repair-State Cleanup Delete** and **Repair-State Recovery Navigation** to clear the repair state and reopen character selection.
- "whether a registered character name may change" was ambiguous between benign refresh and identity tampering; resolved: use **Character Name Immutability** and treat later name mismatches as tamper evidence.
- "what to do with a registered name mismatch" was ambiguous between permissive logging and entry rejection; resolved: use **Character Name Mismatch Handling** with rejection plus low-severity tamper evidence logging.
- "where a new character name comes from" was ambiguous because registration data omitted it; resolved: use **Registration Name Source** with required `characterName` on first-time registration only.
- "where a new character portrait comes from" was ambiguous because registration data omitted it; resolved: use **Registration Portrait Source** with required `portraitShardId` on first-time registration only.
- "how location display data is supplied" was ambiguous between client supply and server derivation; resolved: use **Registration Location Fields** with both `locationId` and `lastLocationName`.
- "how repeat registrations update snapshots" was ambiguous between replacement and merge semantics; resolved: use **Registration Snapshot Merge Rule** with present-and-valid field updates only.
- "what registration returns" was ambiguous between full refetch and mutation ack; resolved: use **Registration Response Shape** with updated Character summary plus created/refreshed status.
