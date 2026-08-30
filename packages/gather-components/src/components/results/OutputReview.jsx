import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';
import { ActionButton } from '../actions/ActionButton.jsx';
import { Heading, Helper, Panel } from '../primitives.jsx';
import { ResultRow, ResultSection } from './ResultSection.jsx';
import { buildOutputReviewSections } from './outputSchema.js';

export function OutputReview({
  data,
  display = null,
  schema,
  title,
  description,
  primaryAction,
  secondaryAction = null,
  busy = false,
  testIDPrefix = 'output-review',
}) {
  const theme = useTheme();
  const displayMetadata = display ?? schema ?? null;
  const sections = buildOutputReviewSections({ data, display: displayMetadata });
  const resolvedTitle = title ?? displayMetadata?.title ?? 'Review output';
  const resolvedDescription = description ?? displayMetadata?.description ?? 'Confirm this output before continuing.';
  const primaryLabel = primaryAction?.label ?? displayMetadata?.primaryActionLabel ?? null;
  const secondaryLabel = secondaryAction?.label ?? displayMetadata?.secondaryActionLabel ?? null;

  return (
    <Panel>
      <View style={styles.resultHeader}>
        <View style={[styles.successMark, { backgroundColor: theme.colors.secondary }]}>
          <Text style={[styles.successMarkText, { color: theme.colors.onSecondary }]}>OK</Text>
        </View>
        <View style={styles.resultHeaderCopy}>
          <Heading>{resolvedTitle}</Heading>
          {resolvedDescription ? <Helper>{resolvedDescription}</Helper> : null}
        </View>
      </View>

      {sections.length ? (
        sections.map((section) => (
          <ResultSection key={section.id} title={section.label}>
            {section.rows.map((row) => (
              <ResultRow key={row.key} label={row.label} value={row.value} />
            ))}
          </ResultSection>
        ))
      ) : (
        <Helper>No output values are available.</Helper>
      )}

      <View style={styles.actionRow}>
        {primaryLabel ? (
          <ActionButton
            label={primaryLabel}
            onPress={() => primaryAction?.onPress?.(data)}
            disabled={busy || primaryAction?.disabled}
            style={[styles.flexAction, secondaryLabel ? null : styles.singlePrimary]}
            testID={primaryAction?.testID ?? `${testIDPrefix}-primary`}
          />
        ) : null}
        {secondaryLabel ? (
          <ActionButton
            label={secondaryLabel}
            variant="secondary"
            onPress={() => secondaryAction?.onPress?.(data)}
            disabled={busy || secondaryAction?.disabled}
            style={styles.flexAction}
            testID={secondaryAction?.testID ?? `${testIDPrefix}-secondary`}
          />
        ) : null}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  resultHeaderCopy: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  successMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successMarkText: {
    fontSize: tokens.typography.helper,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  flexAction: {
    flex: 1,
  },
  singlePrimary: {
    flex: 0,
    alignSelf: 'flex-start',
  },
});
