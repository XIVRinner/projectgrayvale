# Features Layer

Each feature should own:
- Route entry point
- Smart container component
- Dumb view and smaller presentational sub-components
- Local store slice (actions/reducer/selectors/effects) when needed

Features communicate through actions/selectors, not internal imports.
