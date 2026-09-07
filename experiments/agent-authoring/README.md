# Agent-authoring smoke test

Can the Composer's own agent author a Gather Tool from the catalog alone? This
is a **discoverability** experiment: everything it needs already executes, and
the question is whether the catalog tells it enough to wire a Tool without a
human who has read our source.

One fixed prompt, so runs are comparable:

> Create a Gather Tool that lets a researcher choose or capture an image,
> persists that image, segments the subject using `image.segment`, measures the
> segmented area, shows the original image and segmentation for review, and
> returns the image, area, and area unit. Use an appropriate compatible Gather
> model.

```bash
node gates/agent-authoring/run.mjs out.json     # needs gemini.env
```

The key is typed into the Composer's own Settings and stays in that browser
profile. It never enters the repository, an image, or the deploy environment.

## Baseline — 2026-09-06, before any metadata was added

`baseline-before-metadata.json`, 24 components. The agent got the **shape** of a
Gather Tool right and the **computation** entirely wrong.

What it discovered:

```text
components   Flow · MultiImageCapture · ImageOverlay · ProcessingView · Card · Row
outputs      image, area, unit          ← sensible names, correct intent
```

What it did with the actual work:

```text
capture_submit_btn   event "start_processing"        ← expected somebody else to compute
review_submit_btn    functionCall gather_completeComposition
```

**It never called `gather_persistAsset`, `image_segment` or `measure_area`.**
`inspectComposition` reports zero capabilities used. The one function it did call is
the one whose name explains itself.

So it fell back to dispatching an **event** and assuming a registered handler
would do the segmentation — the pre-M9 model, which is exactly the thing
handler-free authoring exists to replace.

## Why, from what it could see

Measured against the deployed catalog:

```text
"resultPath" appears in the catalog payload:   0 times
gather_persistAsset          description:      NONE
image_segment                description:      NONE
measure_area                 description:      NONE
gather_completeComposition   description:      NONE
```

The agent saw four function names with typed parameters and no statement of
what any of them does or when to use one, and no way to learn that a result can
be routed anywhere. Treating them as unusable and falling back to an event is a
reasonable inference from that evidence.

This is a **discoverability failure, not a runtime one**: the same four
functions execute correctly when a Tool calls them, as `gates/tool-preview`
proves on every run.


## After the metadata — same prompt, same outcome

`after-metadata.json`. Descriptions were added to every Gather function (derived
from the Capability definitions) and the `resultPath` contract was documented
once on the Button's `action` property. The catalog now carries both:

```text
"resultPath" appears in the catalog payload:   2 times
gather_persistAsset   "Persist a capture — Make a camera or file capture durable…"
image_segment         "Segment image — Generate a segmentation mask for an image…"
measure_area          "Measure area — Area of the masked region, in pixel units."
```

The agent produced the same shape of Tool and the same mistake:

```text
BEFORE   capture_submit_btn   event start_processing
AFTER    btn_persist          event process_image
```

Zero capabilities used, both times.

## The actual cause: upstream's system prompt

`shell/src/app/chat/chat-prompt-factory/chat-prompt-factory.service.ts`
serializes the whole catalog into the system prompt — functions included — and
then tells the model what an action is:

```json
"action": {
  "event": { "name": "selectItem", "context": { … } }
}
```

**`functionCall` appears zero times in that prompt.** Its worked example uses
`action.event`, its "Actions and Context" section documents only events, and
nothing suggests an action can invoke a catalog function or route a result.

The agent was following its instructions correctly. Our catalog metadata was
never the binding constraint — it was necessary, and it was not sufficient.

### What would fix it

A third upstream patch, and a generic one: `functionCall` is part of the A2UI
v0.9 spec and `catalog.invoker` is upstream's own machinery, so a prompt that
never mentions it under-describes upstream's own capability. Something of the
form "when the catalog declares functions, an action may be
`{ functionCall: { call, args }, resultPath }`" names nothing about Gather.

That is a strong upstream contribution candidate — arguably stronger than the
other two, because the gap is in upstream's description of its own feature.

**Not applied.** Patch count stands at two, and this is the decision to take
before a third.


## After patch 0003 — same prompt, same outcome again

`after-functioncall-guidance.json`. The upstream agent prompt now documents
`action.functionCall`, tells the model to prefer an advertised catalog function
over inventing an event, and demonstrates one beside the event example.

```text
analyze_btn   event analyze_image
submit_btn    call gather_completeComposition
```

Zero capabilities used, for the third time.

### The prompt is not the problem either

Intercepting the actual request to Gemini settles it. In 108,695 bytes:

```text
functionCall           9 occurrences   ← patch 0003's guidance is present
translate_text         2               ← its worked example is present
image_segment          2               ← the function is in the serialized catalog
gather_persistAsset    1
resultPath             2               ← Gather's action metadata is present
```

Everything we thought was missing is in front of the model, and it still
dispatches an event.

## Where that leaves the diagnosis

Three interventions, no behavioural change. The remaining explanations are about
**salience and phrasing**, not availability:

- the prompt is ~109KB and overwhelmingly component-oriented; `image_segment`
  appears twice in it;
- the model must bridge `image.segment` (what a person writes, and what the
  request said) to `image_segment` (what the catalog advertises);
- the function descriptions are one line each, while the component instructions
  run to hundreds of lines with worked examples.

**Do not read this as "the agent cannot author Gather Tools."** It reads as "we
have not yet found what makes a catalog function salient to this model." That is
a prompt-and-metadata investigation, and it should be bounded — the value of
agent authoring is real but it is not on the critical path to the vertical
slice, and a human authoring the JSON works today.

Patch 0003 is kept regardless: upstream genuinely under-describes a feature it
implements, and that is worth fixing whether or not it moves this particular
model.


## Conclusion — investigated, not blocking

> **Known v0.9 authoring limitation.** The current upstream Composer agent
> strongly favours event-based component patterns even when Catalog Functions
> and `functionCall` guidance are both available in its prompt. Re-evaluate
> after the A2UI v1 migration.

M11 does not depend on one-shot generation. What it needs — and what already
works — is:

```text
authored Tool → Composer → Gather Catalog → real Components → real FunctionCalls
              → real model → real ORT-Web execution → chained result
```

`gates/tool-preview` proves that on every run.

### Keep these three artifacts

`baseline-before-metadata.json`, `after-metadata.json` and
`after-functioncall-guidance.json`, together with the fixed prompt in
`run.mjs`, are the regression test for the v1 migration. Run the identical
request against v1 and see whether it reaches the Capability path. That settles
"is v1's authoring better" by measurement rather than argument.

### A cheap lever, deliberately not built

If the demo later wants the "describe what you want" moment, the answer is
**not** another edit to a 109KB upstream prompt. It is a small, high-salience
authoring instruction the *wrapper* attaches to a researcher's request —
product-specific guidance, so it belongs to us:

```text
For Gather Tools:
  use advertised Gather Functions for computation; do not invent events to
  compute; use image_segment for image.segment; use resultPath to pass a
  returned value to later operations; use gather_completeComposition to
  return final outputs.
```

Worth recording now, worth building only if the demo needs it — and only after
v1, in case v1 makes it unnecessary.

### One mapping the agent should not have to infer

A person writes `image.segment`; the catalog advertises `image_segment`. The
alias is deterministic and reversible and should stay, but authoring metadata
could simply say both:

```text
Capability     image.segment
A2UI function  image_segment
```

Not a reason to change the convention — a reason for the future authoring layer
to state it.
