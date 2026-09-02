import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { A2UIHost } from '../../a2ui/mobile/A2UIHost.js';
import { mobileBasicImplementations } from '../../a2ui/mobile/basicCatalog.js';
import { gatherComponentImplementations } from '../../a2ui/mobile/gatherComponents.js';
import { gatherComponentApis, mobileBasicApis } from '../../a2ui/mobile/componentApis.js';
import { FormField } from '../../components/forms/FormField.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { compositionConfigFrom } from './recognition.js';
import { createHostFunctions, mergeFunctions } from '../../a2ui/hostFunctions.js';
import { createExecutionReceipt } from '../../scientific/provenance/receipt.js';

const COMPONENT_APIS = [...mobileBasicApis, ...gatherComponentApis];
const IMPLEMENTATIONS = { ...mobileBasicImplementations, ...gatherComponentImplementations };

/**
 * The Gather-enhanced **composition field**.
 *
 * Hosts an authored composition for a group carrying
 * `gather-composition:<id>`, and commits its typed result through the form's
 * binding manifest:
 *
 * ```text
 * A2UIHost → accepted result + receipt → commitCompositionResult → XForms values
 * ```
 *
 * This control owns none of that logic. Resolution comes from the manifest
 * (`resolveCompositionFields`), commit and provenance from
 * `commitCompositionResult`, and both arrive through the injected `composition`
 * adapter — the same shape the collection field's `collection` adapter has.
 * What this adds is mounting, and turning a refused Accept into something the
 * researcher can read.
 *
 * **A missing composition is stated, not hidden.** A group can declare a
 * composition this build cannot run: the definition may travel as a form
 * attachment, but the handler is *code* and has to be registered — see the
 * known limitation in docs/components-capabilities-ownership.md §10 and the
 * publishing caveat in docs/b-custom-composition-conventions.md §6. Rendering
 * nothing would be the worst outcome, since the group's backing fields are
 * suppressed (§5) and nothing else on screen would explain the gap.
 */
export function XFormsCompositionControl({ node, indent, onLayout, composition }) {
  const theme = useTheme();
  const [message, setMessage] = useState(null);
  const [committed, setCommitted] = useState(null);

  const config = compositionConfigFrom(node?.appearances);
  const field = composition?.fieldFor?.(node.reference) ?? null;
  const entry = config.compositionId ? composition?.entryFor?.(config.compositionId) ?? null : null;

  const handleAccepted = useCallback(
    async (result, context) => {
      setMessage(null);
      try {
        const outcome = await composition?.onAccepted?.({
          field,
          result,
          receipt: context?.receipt ?? null,
        });
        // A refused Accept throws; reaching here means the values are written.
        setCommitted({
          at: new Date().toISOString(),
          written: outcome?.writes?.filter((write) => write.present).length ?? 0,
        });
        if (outcome?.persisted === false) {
          setMessage('Recorded, but not yet saved to this draft. Save the draft to keep it.');
        } else if (outcome?.provenanceFailures?.length) {
          // The values landed; only provenance is incomplete. Saying so is
          // better than reporting a failure that did not happen.
          setMessage('Saved, but this result could not be marked as computed.');
        }
        return outcome;
      } catch (error) {
        setMessage(error?.message ?? 'This result could not be saved.');
        throw error;
      }
    },
    [composition, field]
  );

  const createActionHandler = useMemo(() => entry?.createActionHandler ?? null, [entry]);

  /**
   * The functions this composition may call: Capabilities the app registered,
   * plus the two Gather host seams bound to *this* instance.
   *
   * Host implementations are built here rather than imported, because they need
   * live context the module scope does not have — the resolved field's binding
   * manifest, the draft, and the Accept lifecycle.
   */
  const functions = useMemo(
    () =>
      mergeFunctions(
        composition?.capabilityFunctions ?? [],
        createHostFunctions({
          persistAsset: composition?.persistAsset
            ? ({ capture, retention }) => composition.persistAsset(capture, { retention })
            : undefined,
          completeComposition: field
            ? async ({ outputs }) => {
                // An authored composition has no handler to mint provenance, so
                // the host does it from the composition's identity. "Computed"
                // means produced by the composition, not by a model.
                const receipt = createExecutionReceipt({
                  capability: field.compositionId,
                  capabilityRevision: String(entry?.definition?.revision ?? '0'),
                  inputs: {},
                  outputs,
                  runtime: { kind: 'composition', surfaceId: entry?.definition?.surfaceId ?? null },
                  timestamp: new Date().toISOString(),
                });
                return handleAccepted(outputs, { receipt });
              }
            : undefined,
        })
      ),
    [composition, entry, field, handleAccepted]
  );

  const unavailable = useMemo(() => {
    if (!config.compositionId) return 'This group declares a composition but names none.';
    if (!entry) return `Composition "${config.compositionId}" is not available in this build.`;
    if (!field) {
      return `Composition "${config.compositionId}" has no entry in this form's binding manifest, so its results have nowhere to go.`;
    }
    return null;
  }, [config.compositionId, entry, field]);

  return (
    <FormField label={node.label ?? node.reference} hint={node.hint} indent={indent} onLayout={onLayout}>
      {unavailable ? (
        <Text
          accessibilityRole="alert"
          style={[styles.message, { color: theme.colors.textMuted, fontSize: tokens.typography.helper }]}
          testID={`composition-unavailable-${node.reference}`}
        >
          {`${unavailable} Another ODK client can fill this group's fields directly.`}
        </Text>
      ) : (
        <View testID={`composition-host-${node.reference}`}>
          <A2UIHost
            composition={entry.definition}
            componentApis={COMPONENT_APIS}
            functions={functions}
            implementations={IMPLEMENTATIONS}
            createActionHandler={createActionHandler}
            onAcceptedResult={handleAccepted}
          />
        </View>
      )}
      {committed ? (
        <Text
          style={[styles.message, { color: theme.colors.textMuted, fontSize: tokens.typography.helper }]}
          testID={`composition-committed-${node.reference}`}
        >
          {`Recorded ${committed.written} ${committed.written === 1 ? 'value' : 'values'}.`}
        </Text>
      ) : null}
      {message ? (
        <Text
          accessibilityRole="alert"
          style={[styles.message, { color: theme.colors.danger, fontSize: tokens.typography.helper }]}
          testID={`composition-error-${node.reference}`}
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
