import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EntityStatusBadge } from './EntityStatusBadge.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function EntityListItem({ entity, selected = false, onPress, actionLabel }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: selected ? theme.colors.selection : theme.colors.surface }]}>
      <View style={styles.details}>
        <Text style={[styles.label, { color: theme.colors.text }]}>{entity.label || entity.entityId}</Text>
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{entity.entityId}</Text>
      </View>
      {entity.state ? <EntityStatusBadge state={entity.state} /> : null}
      {actionLabel ? <Text style={[styles.action, { color: theme.colors.primary }]}>{actionLabel}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderWidth: 1, borderRadius: tokens.radii.md, flexDirection: 'row', gap: tokens.spacing.sm, minHeight: tokens.interaction.preferredTouchTarget, padding: tokens.spacing.sm },
  details: { flex: 1 },
  label: { fontWeight: '700' },
  meta: { fontSize: tokens.typography.helper },
  action: { fontWeight: '700' },
});
