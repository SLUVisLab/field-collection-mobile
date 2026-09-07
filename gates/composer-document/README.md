# Composer document seam gate

Exercises the protocol that upstream patch `0002-embedded-host-document-seam`
adds, from a **different origin** — which is the point, since same-origin would
let a host cheat by reading the iframe's internals.

`host.html` is served from the site container and frames the Composer, so the
declared message protocol is the only channel that can work.

```text
into the Composer    #a2ui=d1.<base64url(deflate-raw(json))>   upstream, unpatched
out of the Composer  GET_DOCUMENT → DOCUMENT_STATE             patch 0002
                     DOCUMENT_CHANGED                          patch 0002
```

Verified 2026-09-05 against the deployed Composer:

```text
ok   DOCUMENT_CHANGED arrives from a different origin  1 notification(s)
ok   DOCUMENT_STATE answers GET_DOCUMENT               valid=true
ok   requestId is correlated                           req-1
ok   the document round-trips                          2767 chars
ok   a mismatched target origin gets no reply          1 state(s) total
```

The last check matters most: a `GET_DOCUMENT` posted with the wrong
`targetOrigin` produces no answer at all. The Composer replies only to the
origin named in `?hostOrigin=`, so framing it does not entitle you to read what
someone is authoring.
