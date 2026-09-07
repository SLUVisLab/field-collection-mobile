import { StyleSheet, Text, View } from 'react-native';
import { useXFormSelector, useXFormsQuestion, useXFormsRenderModel } from 'odk-xforms-react';

import { XFormsImageControl } from './controls/XFormsImageControl.js';
import { XFormsInputControl } from './controls/XFormsInputControl.js';
import { XFormsReadonlyControl } from './controls/XFormsReadonlyControl.js';
import { XFormsRepeatControl } from './controls/XFormsRepeatControl.js';
import { XFormsCompositionControl } from './compositions/XFormsCompositionControl.js';
import { XFormsMultiImageControl } from './controls/XFormsMultiImageControl.js';
import { XFormsSelectControl } from './controls/XFormsSelectControl.js';
import { compositionConfigFrom } from './compositions/recognition.js';
import { controlKindFor, visibleRenderNodes } from './renderModel.js';
import { tokens } from '../theme/tokens.js';
import { useTheme } from '../theme/useTheme.js';

const selectSnapshot = (state) => state.snapshot;
const indentFor = (depth) => Math.min(Math.max(depth ?? 0, 0), 4) * 8;

function XFormsRenderNode({ node, onLayout, onAttachImage, attachBusy, collection, composition }) {
  const kind = controlKindFor(node);
  const indent = indentFor(node.depth);
  const question = useXFormsQuestion(node.reference);
  const theme = useTheme();

  if (kind === 'group') {
    return (
      <View onLayout={onLayout} style={[styles.group, { gap: tokens.spacing.xs, marginLeft: indent }]}>
        <Text style={[styles.groupTitle, { color: theme.colors.text, fontSize: tokens.typography.heading }]}>
          {node.label ?? node.reference}
        </Text>
        {node.hint ? (
          <Text style={[styles.hint, { color: theme.colors.textMuted, fontSize: tokens.typography.helper, lineHeight: tokens.typography.helperLineHeight }]}>
            {node.hint}
          </Text>
        ) : null}
      </View>
    );
  }

  if (kind === 'multi-image') {
    return <XFormsMultiImageControl node={node} indent={indent} onLayout={onLayout} collection={collection} />;
  }

  if (kind === 'composition') {
    if (composition) {
      return (
        <XFormsCompositionControl
          node={node}
          indent={indent}
          onLayout={onLayout}
          composition={composition}
        />
      );
    }
    // With no adapter there is no runtime to host. This says so plainly
    // rather than falling through to "Unsupported XForms control: group",
    // which would be both wrong and quiet about the consequence — the group's
    // backing fields are suppressed because the composition owns its subtree
    // (docs/b-custom-composition-conventions.md §5), so there is nothing else
    // on screen to explain the gap.
    return (
      <View
        onLayout={onLayout}
        style={[styles.unsupported, { backgroundColor: theme.colors.surfaceWarning, borderRadius: tokens.radii.sm, gap: tokens.spacing.xs, marginLeft: indent, padding: tokens.spacing.md }]}
        testID={`composition-placeholder-${node.reference}`}
      >
        <Text style={[styles.label, { color: theme.colors.text, fontSize: tokens.typography.label }]}>
          {node.label ?? node.reference}
        </Text>
        <Text style={[styles.unsupportedText, { color: theme.colors.textMuted, lineHeight: tokens.typography.helperLineHeight }]}>
          {`Collected by composition "${compositionConfigFrom(node.appearances).compositionId}", which this build cannot run. Its fields are hidden here; another ODK client can fill them directly.`}
        </Text>
      </View>
    );
  }

  if (kind === 'repeat' || kind === 'repeat-instance') {
    return <XFormsRepeatControl node={node} kind={kind} indent={indent} onLayout={onLayout} />;
  }

  if (kind === 'note') {
    return (
      <View
        onLayout={onLayout}
        style={[styles.note, { backgroundColor: theme.colors.surfaceWarning, borderRadius: tokens.radii.sm, gap: tokens.spacing.xs, marginLeft: indent, padding: tokens.spacing.md }]}
      >
        <Text style={[styles.noteText, { color: theme.colors.text, lineHeight: tokens.typography.bodyLineHeight }]}>
          {node.label ?? node.reference}
        </Text>
        {node.hint ? (
          <Text style={[styles.hint, { color: theme.colors.textMuted, fontSize: tokens.typography.helper, lineHeight: tokens.typography.helperLineHeight }]}>
            {node.hint}
          </Text>
        ) : null}
      </View>
    );
  }

  if (kind === 'calculate' || question.readonly) {
    return (
      <XFormsReadonlyControl
        node={node}
        value={question.value}
        indent={indent}
        onLayout={onLayout}
      />
    );
  }

  if (kind === 'image-upload') {
    return (
      <XFormsImageControl
        node={node}
        indent={indent}
        onLayout={onLayout}
        onAttachImage={onAttachImage}
        attachBusy={attachBusy}
      />
    );
  }

  if (kind === 'select-one' || kind === 'select-multiple') {
    return <XFormsSelectControl node={node} indent={indent} onLayout={onLayout} />;
  }

  if (kind === 'text' || kind === 'int' || kind === 'decimal') {
    return <XFormsInputControl node={node} indent={indent} onLayout={onLayout} />;
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.unsupported, { backgroundColor: theme.colors.surfaceDanger, borderRadius: tokens.radii.sm, gap: tokens.spacing.xs, marginLeft: indent, padding: tokens.spacing.md }]}
    >
      <Text style={[styles.label, { color: theme.colors.text, fontSize: tokens.typography.label }]}>
        {node.label ?? node.reference}
      </Text>
      <Text style={[styles.unsupportedText, { color: theme.colors.danger, lineHeight: tokens.typography.helperLineHeight }]}>
        {node.nodeType === 'upload'
          ? 'Unsupported upload. Only image uploads support camera capture; gallery, audio, video, and arbitrary-file selection are unavailable.'
          : `Unsupported XForms control: ${node.nodeType}${node.valueType ? ` (${node.valueType})` : ''}.`}
      </Text>
    </View>
  );
}

export function XFormsRenderer({
  onNodeLayout,
  onAttachImage,
  attachBusy = false,
  collection = null,
  composition = null,
}) {
  const renderModel = useXFormsRenderModel();
  const snapshot = useXFormSelector(selectSnapshot);
  const nodes = visibleRenderNodes(renderModel, snapshot);

  return nodes.map((node) => (
    <XFormsRenderNode
      key={`${node.reference}:${node.nodeId}`}
      node={node}
      onLayout={(event) => onNodeLayout?.(node.reference, event)}
      onAttachImage={onAttachImage}
      attachBusy={attachBusy}
      collection={collection}
      composition={composition}
    />
  ));
}

const styles = StyleSheet.create({
  group: { paddingTop: 16, paddingBottom: 4 },
  groupTitle: { fontWeight: '700' },
  hint: {},
  note: {},
  noteText: {},
  label: { fontWeight: '600' },
  unsupported: {},
  unsupportedText: {},
});
