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
 * Hosts an authored composition for a group carrying `gather-composition`, and
 * commits its typed result into the group's own child questions:
 *
 * ```text
 * A2UIHost → accepted result + receipt → commitCompositionResult → XForms values
 * ```
 *
 * This control owns none of that logic. Resolution comes from the XForm itself
 * (`compositionBinding.js`), commit and provenance from
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
  // The definition comes from the FORM, pinned to its version. The registry is
  // consulted only for optional app-shipped behaviour — a composition with no
  // handler is a completely valid handler-free composition.
  const definition = field ? composition?.definitionFor?.(node.reference) ?? null : null;
  const handler = config.compositionId
    ? composition?.handlerFor?.(config.compositionId) ?? null
    : null;

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

  // A handler-free composition still needs an action handler slot for A2UIHost;
  // authored behaviour runs entirely through Component bindings and
  // `action.functionCall`, so a no-op suffices.
  const createActionHandler = useMemo(
    () => handler?.createActionHandler ?? (() => async () => undefined),
    [handler]
  );

  /**
   * The functions this composition may call: Capabilities the app registered,
   * plus the two Gather host seams bound to *this* instance.
   *
   * Host implementations are built here rather than imported, because they need
   * live context the module scope does not have — the resolved field's
   * bindings, the draft, and the Accept lifecycle.
   *
   * They are named `useCallback`s rather than inline arrows inside the object
   * literal: a conditional whose branches are destructuring arrows in a
   * property position crashes the Hermes transform with `Property id of
   * VariableDeclarator ... got "ObjectExpression"`, and the failure is a Metro
   * 500 at bundle time, not a runtime error.
   */
  const persistAssetFn = useCallback((args) => composition.persistAsset(args.capture), [composition]);

  const completeCompositionFn = useCallback(
    async (args) => {
      const outputs = args.outputs;
      // An authored composition has no handler to mint provenance, so the host
      // does it from the composition's identity. "Computed" means produced by
      // the composition, not by a model.
      const receipt = createExecutionReceipt({
        capability: field.compositionId,
        capabilityRevision: String(definition?.revision ?? '0'),
        inputs: {},
        outputs,
        runtime: { kind: 'composition', surfaceId: definition?.surfaceId ?? null },
        timestamp: new Date().toISOString(),
      });
      return handleAccepted(outputs, { receipt });
    },
    [definition, field, handleAccepted]
  );

  const functions = useMemo(
    () =>
      mergeFunctions(
        composition?.capabilityFunctions ?? [],
        createHostFunctions({
          persistAsset: composition?.persistAsset ? persistAssetFn : undefined,
          completeComposition: field ? completeCompositionFn : undefined,
        })
      ),
    [completeCompositionFn, composition, field, persistAssetFn]
  );

  /**
   * Why this composition cannot run — **never** merely "no bespoke JS".
   *
   * Since definitions travel with the form, unavailability now means the form
   * is mispackaged or its definition is unusable. A missing handler is not a
   * failure at all.
   */
  const unavailable = useMemo(() => {
    // Resolution problems are specific and worth stating verbatim: an unbound
    // output, a type that cannot reach its destination, a group with no
    // question to write into. Each names something an author can fix.
    const problem = composition?.definitionProblemFor?.(node.reference) ?? null;
    if (problem) return problem;
    if (!definition) {
      return `The composition for this group has no definition among this form version's resources.`;
    }
    if (!field) {
      return 'This group declares a composition, but none of its questions match the outputs the composition produces.';
    }
    return null;
  }, [composition, definition, field, node.reference]);

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
            composition={definition}
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
