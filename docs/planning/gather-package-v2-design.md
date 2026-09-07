# `.gather` v2 — design

**Status: designed, not built.** Grounded in what `inspectComposition()` actually
reports for the canonical Segment & Measure Tool, not in the speculative
structure the original M11 document sketched. Everything below that the old
sketch also proposed is here because a current requirement asks for it; the rest
is gone.

## The publication invariant

> **A published `.gather` v2 artifact has a closed, exact dependency set.**

Every model-backed call resolves to one immutable `ModelRef` at publication, or
publication is refused. `inspectComposition` already reports the four cases and which
side of the line each falls on:

| selection | dependency | v2 |
| --- | --- | --- |
| `explicit` | exact | allowed |
| `bound` + static | exact | allowed |
| `default` | unresolved → **resolved at publish** | allowed |
| `bound` + dynamic | indeterminate | **blocked** |

A Tool that chooses its model from state at run time cannot be described by a
frozen dependency set — a package claiming `requires A` for a Tool that may
select B is a lie the format would be telling on the author's behalf. Blocking
is the honest answer.

**Deliberately not designed: a runtime-resolution declaration.** A future
version could allow an indeterminate dependency accompanied by an explicitly
declared *closed* model set and a provider policy, so the package still bounds
what may execute. That is a real feature with real questions (who validates the
set, what happens when the set and the binding disagree) and it is not needed to
ship the vertical slice.

## What packaging consumes

The whole input, from the canonical Tool, verbatim:

```text
capabilities : ["image.segment","measure.area"]
outputs      : ["image","area","area_unit","model_id","model_revision"]
issues       : []

modelCalls[0]
  occurrence : 1.updateComponents.components.5
  capability : image.segment   accepted: segmentation.binary.v1
  selection  : bound /working/modelRef   resolution: static
  dependency : { certainty: "exact",
                 modelRef: { id: "u2netp-salient-segmentation", version: "1.0.0",
                             revision: "sha256:dcbe0ccd…",
                             artifactSha256: "sha256:571926ae…",
                             taskProfile: "segmentation.binary.v1" } }
```

Note what is **not** there and is not needed: no XForms paths, no form id, no
project. `outputs` are output *names*; where each one lands is the XForm's
business.

### Capabilities are packaged; host functions are assumed

`capabilities` excludes `gather_persistAsset` and `gather_completeComposition`,
and that is right — but "not a packaged dependency" is not "not a requirement":

```text
Capabilities     portable semantic requirements   → dependency closure, installed
Host functions   Gather host ABI requirements     → verified, never packaged
```

A Tool that calls `gather_persistAsset` cannot run on a host that does not
provide it. So the manifest must not imply the Tool has no host requirements.
Host-function usage is **derived from the composition at load** — the calls are
right there — and load fails clearly, naming the function, if this build does
not provide it. Restating them in the manifest would be a second authority that
can disagree with the document.

No host-version negotiation until a concrete compatibility problem appears. The
useful failure today is "this build has no `gather_persistAsset`", not a
semver.

### Publication-resolution of defaults

A `default` selection is resolved **once, at publish**, through the app-owned
`modelPolicy` — the same policy the device uses, never a second mapping:

```text
modelRef omitted  →  defaultModelRefFor(capabilityId, acceptedModelProfiles)
                  →  exact ModelRef  →  frozen into the manifest
```

The **composition is not rewritten**. The document keeps `modelRef` omitted;
the manifest records what that resolved to. Rewriting it would change the
author's Tool as a side effect of publishing, and would make a published Tool
un-editable back into a defaulted one.

#### The frozen resolution must reach execution

Recording it is not enough, and an earlier draft of this design got that wrong.
Consider:

```text
September   publish          default for image.segment = Model A   → manifest freezes A
December    Gather release   default for image.segment = Model B
            packaged Tool still omits modelRef
            → an ordinary resolver picks B
```

The package would not be frozen at all. So:

> **A default resolved at publication remains the effective default whenever
> that package executes.**

The manifest carries the resolution and the **packaged Tool's resolver consults
it first**:

```text
explicit ModelRef in the composition        → use it
statically bound ModelRef                   → use it
omitted, running from a package             → the package's frozen resolution
omitted, running from an editable draft     → current app modelPolicy
```

Same document, two contexts, and the difference is entirely in who is asking.

```json
"modelResolutions": [
  { "capability": "image.segment",
    "selection": "default",
    "modelRef": { "id": "u2netp-salient-segmentation", "revision": "sha256:dcbe0ccd…" } }
]
```

A published package and its draft may therefore diverge as the distribution's
default moves. That is the point: the *package* is frozen, the *draft* is not.

## The manifest is the frozen record — and there is no lock file

The old sketch had `manifest.json` **and** `lock.json`. Pressure-testing what a
lock would own:

| a lock might own | but |
| --- | --- |
| exact model revisions | the manifest states them, and `modelRevisionFor(modelPackage)` **derives** each one from the package in the archive — the package is self-identifying |
| artifact hashes | `modelPackage.artifact.sha256` already carries it, and `modelStore.install` already enforces it |
| composition identity | one digest field in the manifest |
| capability requirements | the manifest states them; they are also re-derivable from the composition |

Nothing is left. A lock would restate facts that are either in the manifest or
in the packages, and a restatement is something that can disagree. **One
manifest, no lock.**

```json
{
  "gatherPackage": 2,
  "tool": {
    "id": "gather.image.segment-and-measure",
    "revision": "1.0.0",
    "title": "Segment and measure",
    "composition": { "path": "composition.a2ui.json", "sha256": "sha256:…" }
  },
  "requires": {
    "capabilities": ["image.segment", "measure.area"],
    "models": [
      {
        "modelRef": { "id": "u2netp-salient-segmentation", "version": "1.0.0",
                      "revision": "sha256:dcbe0ccd…",
                      "artifactSha256": "sha256:571926ae…",
                      "taskProfile": "segmentation.binary.v1" },
        "for": [{ "capabilityId": "image.segment", "selection": "bound" }],
        "path": "models/sha256-dcbe0ccd…"
      }
    ]
  },
  "outputs": ["image", "area", "area_unit", "model_id", "model_revision"],
  "builtAt": "2026-09-06T…Z",
  "builtBy": "gather-tool-composer/<revision>"
}
```

`selection` is recorded per requirement because it is the difference between
"the author pinned this" and "policy chose this at publish", and a reader
reconstructing provenance later needs to know which.

## Layout

Self-contained, and every model included even when Gather already ships it:

```text
tool.gather
├── manifest.json
├── composition.a2ui.json
└── models/
    └── sha256-<revision>/
        ├── model.json          the ModelPackage, verbatim
        ├── model.onnx          artifact bytes
        └── labels.txt          when the package declares labels
```

The directory name is the **ModelRef revision**, which is what the device's
model store is already keyed by (`projects/<key>/models/<revision>/`) and what
the renderer's web provider already serves. Three consumers, one identity.

Including bytes Gather already ships costs 4.4 MB for the canonical Tool. That
is the right trade for v2: a package that is self-contained cannot be broken by
the receiving distribution shipping a different model set, and **installation
deduplicates by revision anyway**, so the cost is transfer, not storage.
Provider-based slimming is a later optimization with a clear seam.

## Deterministic archive

Same Tool and same dependencies must produce the same bytes, because Central
caches a form attachment by hash and because a reproducible artifact is the
point of freezing one.

```text
container      zip, stored or fixed-level deflate — one setting, never "default"
entry order    sorted by path, bytewise
timestamps     fixed epoch for every entry
attributes     no unix modes, no extra fields, no comments
manifest       canonical JSON (gather-hashing's `canonicalize`), sorted keys
```

`manifest.json` is written **last** and digests everything else; its own digest
is the package identity.

### v1 and v2 are distinguished by signature

`.gather` v1 is the composition JSON verbatim — that is what M10 proved on
hardware and it must keep working.

```text
50 4B 03 04 (and the other ZIP signatures)   → a v2 container
optional BOM, then whitespace, then '['      → a v1 composition
```

By **signature**, not by byte zero: legacy JSON may be pretty-printed or carry a
BOM, and a rule that assumed otherwise would fail on a file we already ship.

Sniffing decides only how to *open* the file. Once open,
`manifest.gatherPackage` is authoritative about what the contents mean — the
container and the format version are separate questions, and conflating them is
how a format loses the ability to change.

## Verify and install

Nothing here is new machinery; it is a sequence over existing parts.

```text
.gather bytes
  ↓ sniff PK               v1 → existing path, unchanged
  ↓ read manifest.json     refuse gatherPackage != 2
  ↓ digest composition     must equal tool.composition.sha256
  ↓ for each required model
      already installed at this revision?      → reuse, verify nothing
      else → read model.json
             validateModelPackage(modelPackage)
             modelRevisionFor(modelPackage) must equal the declared revision
             modelStore.install({ projectKey, modelPackage, artifactBytes, labelBytes })
                 ↑ re-checks artifact sha256 itself
  ↓ capabilities present in this build?         → else refuse, naming the missing one
  ↓ composition available through the ordinary form-resource path
```

Two properties worth stating:

- **`modelStore.install` is the only installer.** No `.gather` model store, no
  package-specific inference path. A model that arrives in a Tool is
  indistinguishable afterwards from one that shipped in the binary.
- **The revision is re-derived, never trusted.** `modelRevisionFor(package)`
  must equal what the manifest claims. A manifest that lies about which model
  it carries fails before anything is written.

### The reader is narrow on purpose — built 2026-09-06

`.gather` bytes arrive as a form attachment, so the reader's input is whatever
someone put there. It accepts only the ZIP subset the writer emits and refuses
everything else, by name:

```text
compression method != 0        duplicate entry names
absolute paths                 `..` traversal
backslashes / drive letters    streamed sizes (flag bit 3)
local header self-disagreement entry running past end of file
central directory naming an    central directory disagreeing about
  entry the file lacks           how many entries there are
> 64 entries / 256MB entry     CRC mismatch
```

Being a poor general ZIP library is the intended outcome. `test/packaging/archive-hardening.test.mjs`
forges each of these and asserts a refusal, because a reader is only as narrow
as its worst accepted input.

Two consequences for the layer above:

- **`openTool` requires `modelRevisionFor`.** It was optional, which meant
  identity was only re-derived when a caller remembered to ask. An identity
  checked on request is not an identity.
- **Malformed JSON is a package error, not a `SyntaxError`.** Anyone above this
  line asked "is this a Gather package?" and deserves that answer.

### Verification order — fail before anything is written

`openTool` verifies the whole package and returns; `installTool` writes only
after it does. There is no partial-install path to roll back because there is no
point at which a write can precede a failed check.

### Executing what was installed — built 2026-09-06

A packaged composition renders through the ordinary bridge, the ordinary
catalog and the ordinary capability functions. **There is no `.gather` execution
runtime**, and `gates/gather-package/run.mjs` is written to make that visible:
it installs from bytes, takes the composition the archive yielded, and sends it
through the same `RENDER_A2UI` message a draft uses.

The only thing a package changes is where model bytes come from.
`createInstalledFirstProvider` puts installed models ahead of the distribution's
static assets, so the executed revision is provably the archived one:

```text
gather-package gate, 2026-09-06
  packed                    4.62 MB, one frozen model
  installed                 clean store, alreadyInstalled=false
  reinstalled               alreadyInstalled=true, no second write
  rendered                  composition read from the archive
  image_segment             real, onnxruntime-web@1.29.0, ~3.4s
  measure_area              64,936 px²
  model_revision reported   sha256:dcbe0ccd… — the revision that was frozen
```

## What already exists

| need | existing |
| --- | --- |
| dependency closure | `inspectComposition()` — certainty per call |
| default resolution | `defaultModelRefFor` in app-owned `modelPolicy` |
| package validation | `validateModelPackage` |
| revision derivation | `modelRevisionFor` |
| content digests | `gather-hashing` — `digestBytes`, `canonicalize` |
| install + dedupe | `modelStore.install`, `listInstalled` |
| distribution | the proven `gather_resources` attachment path |
| execution | the Capability runtime, unchanged |

The genuinely new code is: the archive writer, the archive reader, and the
manifest schema. Everything else is composition.

## Does the package ever need to know its XForm?

**No**, and the canonical Tool demonstrates why. Its outputs are names —
`image`, `area`, `area_unit`, `model_id`, `model_revision`. The XForm decides
what each binds to, whether it is required, and whether it is a media
projection; `compositionBinding` matches them by name at run time. That is what
lets one Tool serve several forms, and it is the boundary that keeps a package
portable.

The one thing to watch: if publication ever wanted to *check* a Tool against a
selected form, that check belongs in Review, and its result belongs in a publish
report — not in the artifact.

## Test plan, before implementing

```text
pack
  canonical Tool + resolved deps      → archive
  a defaulted Tool                    → manifest records the resolution,
                                        composition still omits modelRef
  same inputs twice                   → byte-identical
  manifest digests match the entries
  no Central id, form id or XForms path anywhere in the archive

refuse
  a Tool with a dynamic binding       → blocked, naming the occurrence
  a required capability this build lacks
  a manifest whose model revision disagrees with its package
  a corrupted artifact byte           → install fails, nothing written

install
  clean model store                   → model installed, composition available
  second Tool sharing that model      → installed once, reused
  v1 artifact                         → still loads unchanged
  a host missing a called host function → load fails, naming the function

frozen defaults  ← the test that proves the package is actually locked
  package while product default = Model A
  change product default to Model B
  install the package, execute
  Model A runs

execute
  installed Tool runs through the existing Capability runtime
```

The last line is the gate that matters, and it is the M10 chain again with the
Tool arriving as a package instead of a form attachment authored by hand:
**canonical Tool → pack → verify → install on a clean store → execute.**
