import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-native';

import { useNavProbe } from '../navigation/NavProbeContext.js';
import { tokens } from '../theme/tokens.js';
import { useTheme } from '../theme/useTheme.js';

/**
 * Shared screen scaffold used by every M5 placeholder screen. It renders a
 * consistent header (optional back affordance + title), reports its `screenId`
 * to the nav probe on mount (for the gate), and hosts the screen body.
 *
 * Screens stay presentational: they receive data/actions via props or the
 * storage hooks and contain no bootstrap or storage-wiring logic.
 */
export function Screen({
  screenId,
  title,
  subtitle,
  canGoBack = false,
  onBack = null,
  scrollRef = null,
  children,
}) {
  const navigate = useNavigate();
  const { reportScreen } = useNavProbe();
  const theme = useTheme();

  useEffect(() => {
    reportScreen(screenId);
  }, [reportScreen, screenId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]} testID={`screen-${screenId}`}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        {canGoBack ? (
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => (typeof onBack === 'function' ? onBack() : navigate(-1))}
            style={({ pressed }) => [
              styles.back,
              { minHeight: tokens.interaction.minimumTouchTarget },
              pressed && styles.backPressed,
            ]}
            testID={`back-${screenId}`}
          >
            <Text style={[styles.backText, { color: theme.colors.primary, fontSize: tokens.typography.body }]}>
              ‹ Back
            </Text>
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.colors.text, fontSize: tokens.typography.title }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.colors.textMuted, fontSize: tokens.typography.helper }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { gap: tokens.spacing.md, padding: tokens.spacing.xl }]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { justifyContent: 'center' },
  backSpacer: { minHeight: 20 },
  backPressed: { opacity: 0.7 },
  backText: { fontWeight: '600' },
  titleBlock: { marginTop: 6 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 2 },
  body: { flex: 1 },
  bodyContent: {},
});
