# M1 DOM contract experiment

This folder contains the implementation for C0.5 milestone M1 (DOM contract discovery).

## Run

```bash
cd experiments/m1-dom-contract
yarn install --ignore-engines
yarn analyze
yarn m2:oozcitak-smoke
```

Outputs are generated in `out/`:

- `static-dom-usage.json`
- `dynamic-dom-usage.json`
- `dom-contract.json` (raw merged contract)
- `dom-contract.md` (raw merged summary)
- `observed-reference-contract.json` (normalized observed contract + dynamic-only attribution)
- `observed-reference-contract.md` (human summary of M1.1/M1.2)
- `portable-required-contract.json` (portable contract used for M2 candidate scoring)
- `portable-required-contract.md` (human summary of portable requirements)
- `candidates.md` (raw + portable coverage, severity-ranked gaps)
- `m2-oozcitak-smoke.json` (initial M2 runtime smoke result)

## XPath source mode

`yarn prepare:xpath` attempts to clone ODK central-frontend and vendor `packages/xpath` for analysis.
If cloning fails, the scripts automatically fall back to bundled engine dist analysis and record that mode
in `out/xpath-source.json`.
