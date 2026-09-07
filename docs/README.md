# Gather documentation

```text
docs/
  reference/     current and load-bearing — how the system works today
  planning/      where we are going
  archive/       true once; kept for the reasoning, not for guidance
  fixtures/      captured data used by tests and spikes
```

## The filing rule

Documents are sorted by **whether they are still true**, not by what kind of
document they are. An audit whose conclusions are live is reference; an audit
whose conclusions were implemented and moved past is archive. The word "audit"
tells you nothing about which.

**New notes start at the root of `docs/`.** When the work they describe lands,
they move to `reference/` or `archive/`. A nearly-empty root is the signal that
filing is current — if things pile up there, the last few pieces of work have
not been filed.

Nothing is deleted for being old. A superseded document keeps its content and
gains a banner at the top saying what replaced it, because the reasoning that
produced a decision usually outlives the decision.

## reference/

What the system does now. Cited from code comments by path and section, so
these move rarely and never silently.

- **`conventions/`** — the authoring contracts. How a Gather-enhanced field or
  an authored composition is declared, and what the runtime guarantees about it.
- **`architecture/`** — how a subsystem works and why it is shaped that way.
  This is where "we investigated X and decided Y" lives once Y is the code.
- **`runbooks/`** — how to actually run something: gates, emulators, devices.

## planning/

The current roadmap, the running design backlog, and design documents for work
not yet started. `planning/future/` holds pieces that are shaped but
unscheduled; it is created when something belongs there and disappears when the
last piece is scheduled, so its absence means everything planned is on deck.

## archive/

- **`milestones/`** — M5 through M9 plans, status reports and final summaries.
  Point-in-time records of work that shipped.
- **`superseded/`** — documents replaced by a later decision, each carrying a
  banner pointing at what replaced it.

## Conventions

- `kebab-case.md`. No spaces, no capitals, no `(1)`.
- A document that supersedes another says so in the one it replaces, at the top,
  with a link.
- Code cites documents by **path and section** (`docs/reference/conventions/b-custom-composition-conventions.md §4b`),
  not by folder — the section is usually the reason the citation exists.
