# odk-xforms-react

React bindings for `XFormsHost`, designed to keep ODK engine state authoritative while exposing idiomatic React hooks.

## Purpose

This package adapts host subscriptions to React state via `useSyncExternalStore`, without introducing a second form state system.

It depends on `odk-xforms-host` contracts and must not depend on WebView internals.

## v1 API

Exports from [src/index.js](/Users/dev/Code/field-collection-mobile.worktrees/milestone-m1-planning-xforms-engine/packages/odk-xforms-react/src/index.js):

- `XFormsProvider`
- `useXForm()`
- `useXFormSelector(...)`
- `useXFormsNode(reference)`
- `useXFormsQuestion(reference)`
- `useXFormsChoices(reference)`
- `useXFormsRepeat(reference)`
- `XFormsStore`
- `XFORMS_REACT_PHASES`

## Design constraints

- No UI components in this package.
- No Central/network logic.
- No WebView creation or RPC ownership.
- No duplicated mutable form-state model.

## Dependencies

Runtime dependencies:

- `react` (peer dependency)
- local `odk-xforms-host` package contract

Test/runtime tooling:

- Node.js (`node --test`)

## Development

Run tests:

```bash
cd packages/odk-xforms-react
npm test
```
