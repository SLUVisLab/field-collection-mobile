import React, { useEffect, useState } from 'react';

import { subscribeToPreviewLedger } from './previewLedger.js';

/**
 * Says what the preview actually did.
 *
 * An author watching a mask appear will conclude a model ran. Here one did
 * not, and the only thing standing between that impression and a Tool shipped
 * on a false premise is this strip. It is deliberately not dismissible while
 * anything simulated has run.
 */
const LABELS = {
  real: { text: 'real', tone: '#1f6f43' },
  simulated: { text: 'simulated', tone: '#8a5a00' },
  preview: { text: 'preview only', tone: '#4a4f6a' },
};

export function PreviewFidelity() {
  const [entries, setEntries] = useState([]);
  useEffect(() => subscribeToPreviewLedger(setEntries), []);
  if (entries.length === 0) return null;

  // Latest call per function: a Tool re-run should not grow a scroll of history.
  const latest = [...entries].reverse().filter(
    (entry, index, all) => all.findIndex((other) => other.name === entry.name) === index
  );

  return (
    <section className="preview-fidelity" aria-label="Preview fidelity">
      <h2>What this preview ran</h2>
      <ul>
        {latest.map((entry) => {
          const label = LABELS[entry.fidelity] ?? LABELS.preview;
          return (
            <li key={entry.name}>
              <code>{entry.name}</code>
              <span className="preview-fidelity-tag" style={{ color: label.tone }}>
                {label.text}
              </span>
              {entry.detail ? <span className="preview-fidelity-detail">{entry.detail}</span> : null}
            </li>
          );
        })}
      </ul>
      <p>
        Native execution on a device remains authoritative. Nothing here was submitted.
      </p>
    </section>
  );
}
