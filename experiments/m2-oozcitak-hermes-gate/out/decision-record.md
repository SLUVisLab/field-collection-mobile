# Decision Record — M2.0 `@oozcitak/dom`

## Outcome

**M2.0 `@oozcitak/dom` — RED**

## Issue #22 status

**NOT REACHED / NOT REPRODUCED**

## Blocking issue

Published runtime dependency `@oozcitak/url` imports Node core `url`, and Metro cannot resolve Node core modules in this environment.

## Required workaround (not adopted in C0.5)

- Node URL / `domainToASCII` compatibility layer
- Metro resolution configuration

## Decision

Do not patch or polyfill during C0.5. Proceed to the `slimdom` Hermes gate.

`@oozcitak/dom` remains **Plan B2** if `slimdom` later fails for a more fundamental reason.
