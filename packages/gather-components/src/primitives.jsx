import { StyleSheet, Text, View } from 'react-native';

import { tokens } from './theme/tokens.js';
import { useTheme } from './theme/useTheme.js';

/** A bordered content panel (mask review / result grouping). */
export function Panel({ children, tone = 'default', style }) {
  const theme = useTheme();
  const toneStyle =
    tone === 'error'
      ? { borderColor: theme.colors.danger, backgroundColor: theme.colors.surfaceDanger }
      : { borderColor: theme.colors.border, backgroundColor: theme.colors.background };
  return <View style={[styles.panel, toneStyle, style]}>{children}</View>;
}

/** Section heading matching the mobile heading token (20px, 700). */
export function Heading({ children, tone = 'default' }) {
  const theme = useTheme();
  const color = tone === 'error' ? theme.colors.danger : theme.colors.text;
  return <Text style={[styles.heading, { color }]}>{children}</Text>;
}

/** Muted helper/supporting copy. */
export function Helper({ children, tone = 'default' }) {
  const theme = useTheme();
  const color = tone === 'error' ? theme.colors.danger : theme.colors.textMuted;
  return <Text style={[styles.helper, { color }]}>{children}</Text>;
}

/** Title + supporting copy pair used above media/actions. */
export function SectionCopy({ title, body }) {
  return (
    <View style={styles.sectionCopy}>
      <Heading>{title}</Heading>
      {body ? <Helper>{body}</Helper> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: tokens.spacing.md,
    borderWidth: 1,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
  },
  heading: { fontSize: tokens.typography.heading, fontWeight: '700', lineHeight: tokens.typography.heading * 1.2 },
  helper: { fontSize: tokens.typography.helper, lineHeight: tokens.typography.helperLineHeight },
  sectionCopy: { gap: tokens.spacing.xs },
});
