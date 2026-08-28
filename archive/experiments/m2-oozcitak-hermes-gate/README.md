# M2.0 @oozcitak/dom Hermes gate

Small go/no-go gate for `@oozcitak/dom@3.0.0` in Gather's Metro/Babel/Hermes toolchain.

## Run

```bash
yarn m2:oozcitak:gate
```

Outputs:

- `out/m2.0-hermes-gate-results.json`
- `out/m2.0-hermes-gate-results.md`

Current gate behavior:

- Runs Metro bundle attempts for Android/iOS in debug/release modes.
- Executes Hermes runtime only when Metro bundle succeeds.
- Includes issue-#22-focused Babel transpilation checks.

Manual in-app probe screen route:

- `M2OozcitakHermesGate`
