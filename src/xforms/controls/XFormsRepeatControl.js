import { StyleSheet, Text, View } from 'react-native';
import { useXFormsRepeat } from 'odk-xforms-react';

import { ActionButton } from '../../components/NavButton.js';
import { FormField } from '../../components/forms/FormField.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

const repeatInstanceMatch = (reference) => reference?.match(/^(.*)\[(\d+)\]$/) ?? null;

export function XFormsRepeatControl({ node, kind, indent, onLayout }) {
  const match = kind === 'repeat-instance' ? repeatInstanceMatch(node.reference) : null;
  const reference = match?.[1] ?? node.reference;
  const repeat = useXFormsRepeat(reference);
  const label = node.label ?? node.reference;
  const theme = useTheme();

  if (kind === 'repeat-instance') {
    return (
      <View onLayout={onLayout} style={[styles.group, { gap: tokens.spacing.xs, marginLeft: indent }]}>
        <Text style={[styles.groupTitle, { color: theme.colors.text, fontSize: tokens.typography.heading }]}>{label}</Text>
        {node.hint ? (
          <Text style={[styles.hint, { color: theme.colors.textMuted, fontSize: tokens.typography.helper, lineHeight: tokens.typography.helperLineHeight }]}>
            {node.hint}
          </Text>
        ) : null}
        {match ? (
          <ActionButton
            label="Remove"
            onPress={() => void repeat.remove(Number(match[2]) - 1)}
            style={styles.inlineAction}
            testID={`remove-repeat-${node.reference}`}
            variant="danger"
          />
        ) : null}
      </View>
    );
  }

  return (
    <FormField label={label} hint={node.hint} indent={indent} onLayout={onLayout}>
      <ActionButton
        label="Add another"
        onPress={() => void repeat.add()}
        style={styles.inlineAction}
        testID={`add-repeat-${node.reference}`}
        variant="secondary"
      />
    </FormField>
  );
}

const styles = StyleSheet.create({
  group: { paddingTop: 16, paddingBottom: 4 },
  groupTitle: { fontWeight: '700' },
  hint: {},
  inlineAction: { alignSelf: 'flex-start' },
});
