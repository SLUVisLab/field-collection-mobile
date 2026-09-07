# What form refresh actually costs

**Correction first.** An earlier note in this session claimed refresh took six
minutes and blamed a large Entity List. That was wrong. It was inferred from a
screen that sat on "refreshing forms" for a different reason and never
verified. Measured on device against the live Central project:

```text
refreshForms  1.1s   (4 forms, all versions unchanged)
```

The wire is not the problem either:

| call | time | bytes |
| --- | --- | --- |
| `formList` | 0.50s | 2 307 |
| `manifest` × 4 | 0.22–0.42s each | 115–1 014 |
| `plants.csv` (Entity List) | 0.24s | 1 522 |
| `silphium-reference.jpg` | 0.27s | 33 236 |

A cold refresh of this project is a couple of seconds. There is no
long-refresh bug to work around.

## There is a real inefficiency, and it is not about time

`refresh()` already short-circuits an unchanged form version — it compares
`(sourceVersion, sourceHash, manifestFingerprint)` and promotes the existing
cache entry without downloading. The problem is the **granularity of that
key**: the fingerprint covers the *whole manifest*, so if any one resource
changes, every resource of that form is re-downloaded and re-stored.

Observed on the device, same form version, two cache revisions:

```text
version 20260827222256  plants.csv             md5:0731400c…  revision-1x7ksxb…
version 20260827222256  plants.csv             md5:48a0866a…  revision-1qakjmt…
version 20260827222256  silphium-reference.jpg md5:8112cfe2…  revision-1x7ksxb…
version 20260827222256  silphium-reference.jpg md5:8112cfe2…  revision-1qakjmt…
                                               ↑ identical, stored twice
```

The JPEG never changed. It was downloaded and written a second time because a
*sibling* resource did.

## Why this gets worse with Entities, specifically

OpenRosa is explicit that caching is per media file:

> If the hash value identified in the manifest differs from the hash value when
> the media file was previously downloaded, then the file should be re-fetched
> from the server.
> — [OpenRosa Form Manifest](https://docs.getodk.org/central-api-openrosa-endpoints/)

And Central adds an amplifier:

> For Attachments that are linked to a Dataset, the value of `hash` is an MD5
> sum derived from **the last updated timestamp of the Dataset**. It is not the
> MD5 sum for the content of the Dataset CSV file.

So an Entity List's manifest hash changes whenever the dataset is *touched* —
even when the CSV bytes are identical. Every touch bumps our manifest
fingerprint, which mints a new form version, which re-downloads and re-stores
every attachment of that form.

For a project with a frequently-updated Entity List and heavy reference media,
that is the cost that grows: not one slow refresh, but repeated re-downloads of
unchanged media, and a cache directory per churned version.

## The fix — landed 2026-09-04

Two different questions, and they get two different fields:

```text
resource_hash   the SERVER's validator   →  must I fetch this again?
blob_digest     OUR digest of the bytes  →  do I already hold these?
```

They cannot be one field, and the Entity case is why. Central derives a Dataset
attachment's hash from the dataset's last-updated timestamp, so the validator
changes when the content does not. The first can force a download that the
second then proves was redundant — and we still decline to write a second copy.

```sql
resource_blobs   (digest PRIMARY KEY, byte_length, file_key, created_at)
form_resources   + blob_digest          -- migration 13
```

Payloads live at `projects/<key>/resources/blobs/<digest>`. A form revision
**references** bytes; it no longer owns them. Rows written before migration 13
carry `blob_digest = ''` and still resolve through `file_key`, so nothing
re-downloads on upgrade.

Per resource, the refresh now asks both questions in order:

```text
validator unchanged for this (form, filename)?
  └ yes, and the blob is still on disk  →  reuse it, no download
  └ no                                  →  download (the spec requires it)
                                             digestBytes(bytes)
                                             blob exists?  →  reference it
                                             otherwise     →  write once
```

So the reference JPEG is **not fetched at all** when only the entity list
changed, and a churned Entity List whose bytes are identical is fetched but not
stored again.

### Cleanup is mark-and-sweep, not reference counts

`src/forms/resourceBlobCleanup.js`. A counter has to stay correct across a
refresh that dies between writing the blob and recording the row, and getting
that wrong either strands bytes or deletes bytes a form still needs.
Reachability is recomputed from the rows that exist, so a failed refresh just
leaves work for the next sweep. The number of form resources on a device is
nowhere near large enough for the difference to cost anything.

It runs at the end of a refresh — the moment the reachable set changes — and is
best-effort: an uncollected blob costs disk, and failing a refresh over it would
cost the fieldwork. `reclaimOrphans` defaults to false for the same reason it
does for project assets.

### Proved on device, 2026-09-04

Migration 13 applied against the real database with existing cached forms, then
two new versions of the gate form were published carrying the *same* attachment
— the shape an Entity List churn produces for its sibling media.

```text
source_version   filename           validator      blob
gate-6a1366      flower_v1.gather   md5:3ecc2476   (empty — pre-migration row)
blob-a           flower_v1.gather   md5:3ecc2476   bc35dc46e937
blob-b           flower_v1.gather   md5:3ecc2476   bc35dc46e937

resource_blobs                       1 row
files under resources/blobs/         1
```

Three form versions, **one payload**. The pre-migration row still resolves
through its old `file_key` and did not re-download, which is what the empty
`blob_digest` is for. Before the change the same three versions meant three
copies.

## Original proposal, for the record

Key a resource payload by **its own `md5:` hash** rather than by the form
version that happened to reference it. A new form version then reuses an
existing payload whenever the hash matches, and downloads only what genuinely
changed — which is what the spec describes and what Collect does.

```text
now   resources/<form>/<revision>/<resource>/payload     re-fetched per version
then  resources/<form>/blob/<md5>                        re-fetched per content
```

`form_resources` already stores `resource_hash`, so the mapping from a version
to its payloads is already recorded; only the storage key and a
"do we already have this blob?" check would change. Cleanup becomes
reference-counted rather than per-version, which is the one part that needs
care.

**Not worth doing:** avoiding the per-form manifest fetch. The Form List
`<hash>` covers only the form definition, not media, and the spec gives no
exemption from fetching the manifest — so N+1 round trips are inherent to
OpenRosa. Fetching those manifests concurrently would help a project with many
forms on a slow link; that is a small, separate change.

## Sources

- [OpenRosa Form List API](https://docs.getodk.org/openrosa-form-list/)
- [ODK Central OpenRosa Endpoints](https://docs.getodk.org/central-api-openrosa-endpoints/)
- [OpenRosa Protocol](https://docs.getodk.org/openrosa/)
