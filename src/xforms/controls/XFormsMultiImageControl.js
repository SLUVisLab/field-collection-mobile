import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useXForm, useXFormsRepeat } from 'odk-xforms-react';

import { MultiImageCapture } from 'gather-components';
import { FormField } from '../../components/forms/FormField.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import {
  binaryChildrenOf,
  collectionItemsFrom,
  multiImageConfigFrom,
  newestBinaryChild,
  orphanedFilenames,
} from '../collectionField.js';

/**
 * The Gather-enhanced **multi-image collection field**.
 *
 * Renders `MultiImageCapture` for a repeat carrying the `gather-multi-image`
 * appearance. This control is the adapter between the two models — it owns the
 * XPath and repeat APIs so the Component does not:
 *
 * ```text
 * /data/photos[1]/photo   ↕
 * /data/photos[2]/photo   ↕   repeat<ImageAsset>   ↔   ImageAsset[]
 * ```
 *
 * - **capture** → add a repeat instance → persist the attachment into its image
 *   node (the host mints the filename and writes it as the node value).
 * - **remove** → drop the repeat instance → clean up the now-orphaned media.
 *
 * Reorder is deliberately unavailable: repeat positions reindex, so reordering
 * instances is exactly the operation that made positional identity unsafe. See
 * docs/repeat-media-identity-characterization.md.
 *
 * Conventions in docs/b-standard-field-conventions.md.
 */
export function XFormsMultiImageControl({ node, indent, onLayout, collection }) {
  const theme = useTheme();
  const form = useXForm();
  const repeat = useXFormsRepeat(node.reference);
  const [message, setMessage] = useState(null);

  const config = multiImageConfigFrom(node.appearances);
  const snapshot = form?.snapshot ?? null;
  const valueAt = (reference) => snapshot?.nodesByReference?.[reference]?.instanceValue ?? '';

  // The image child's name is the form author's (`photo`, `image`, `frame`, …),
  // so it is read from the engine for both projection and capture rather than
  // assumed by either.
  const binaryChildren = binaryChildrenOf({
    repeatReference: node.reference,
    nodesByReference: snapshot?.nodesByReference,
  });

  const items = collectionItemsFrom({
    instanceReferences: repeat?.instances ?? [],
    binaryChildOf: (instanceReference) => binaryChildren.get(instanceReference) ?? null,
    valueAt,
    media: collection?.media ?? [],
    uriFor: collection?.uriFor,
  });

  const handleCapture = useCallback(
    async (capture) => {
      setMessage(null);
      try {
        // Add first, then resolve the new instance's image node from a fresh
        // snapshot — the child's name is the form author's, not ours to assume.
        await repeat.add();
        const refreshed = await form.refreshSnapshot('collection-capture');
        const reference = newestBinaryChild(
          binaryChildrenOf({
            repeatReference: node.reference,
            nodesByReference: refreshed?.nodesByReference,
          })
        );
        if (!reference) throw new Error('The new photo slot could not be resolved.');
        await collection?.onCapture?.(reference, capture);
      } catch (error) {
        setMessage(error?.message ?? 'Could not add that photo.');
      }
    },
    [collection, form, node.reference, repeat]
  );

  const handleChange = useCallback(
    async (next) => {
      setMessage(null);
      const orphans = orphanedFilenames({ before: items, after: next });
      if (orphans.length === 0) return;
      try {
        // Remove from the highest position down, so earlier removals cannot
        // shift the indices of the ones still to go.
        const doomed = items
          .filter((item) => orphans.includes(item.filename))
          .sort((left, right) => right.position - left.position);
        for (const item of doomed) {
          await repeat.remove(item.position - 1);
        }
        await collection?.onRemove?.(orphans);
      } catch (error) {
        setMessage(error?.message ?? 'Could not remove that photo.');
      }
    },
    [collection, items, repeat]
  );

  return (
    <FormField
      label={node.label ?? node.reference}
      hint={node.hint}
      indent={indent}
      onLayout={onLayout}
    >
      <MultiImageCapture
        value={items}
        minItems={config.minItems}
        maxItems={config.maxItems}
        allowRemove
        allowReorder={false}
        onCapture={handleCapture}
        onChange={handleChange}
        testIDPrefix={`multi-image-${node.reference}`}
      />
      {message ? (
        <Text
          accessibilityRole="alert"
          style={[styles.message, { color: theme.colors.danger, fontSize: tokens.typography.helper }]}
        >
          {message}
        </Text>
      ) : null}
    </FormField>
  );
}

const styles = StyleSheet.create({
  message: { textAlign: 'center' },
});
