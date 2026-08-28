import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../../components/Screen.js';
import { ActionButton } from '../../components/NavButton.js';
import { useGather } from '../../context/GatherContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function SetupConnect() {
  const { actions } = useGather();
  const [baseUrl, setBaseUrl] = useState('');
  const [projectId, setProjectId] = useState('');
  const [token, setToken] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const theme = useTheme();
  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderStrong,
      borderRadius: tokens.radii.sm,
      color: theme.colors.text,
      fontSize: tokens.typography.body,
      minHeight: tokens.interaction.preferredTouchTarget,
      paddingHorizontal: tokens.spacing.md,
    },
  ];

  const connect = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await actions.provisionManual({ baseUrl, projectId, token, displayName });
      setToken('');
    } catch (cause) {
      setError(
        cause?.code?.startsWith('GATHER_')
          ? cause.message
          : 'Gather could not connect this project.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      screenId="setup-connect"
      title="Connect manually"
      subtitle="Enter Central server details"
      canGoBack
    >
      <Text style={[styles.note, { color: theme.colors.textMuted, lineHeight: tokens.typography.bodyLineHeight }]}>
        Gather checks this App User connection before saving it. Your token is stored only in
        device secure storage.
      </Text>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text, fontSize: tokens.typography.helper }]}>Central server URL</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setBaseUrl}
          placeholder="https://central.example.org"
          placeholderTextColor={theme.colors.textMuted}
          style={inputStyle}
          testID="central-base-url"
          value={baseUrl}
        />
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text, fontSize: tokens.typography.helper }]}>Project ID</Text>
        <TextInput
          keyboardType="number-pad"
          onChangeText={setProjectId}
          placeholder="1"
          placeholderTextColor={theme.colors.textMuted}
          style={inputStyle}
          testID="central-project-id"
          value={projectId}
        />
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text, fontSize: tokens.typography.helper }]}>App User token</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setToken}
          secureTextEntry
          placeholderTextColor={theme.colors.textMuted}
          style={inputStyle}
          testID="central-app-user-token"
          value={token}
        />
      </View>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text, fontSize: tokens.typography.helper }]}>Project name</Text>
        <TextInput
          onChangeText={setDisplayName}
          placeholder="Field collection project"
          placeholderTextColor={theme.colors.textMuted}
          style={inputStyle}
          testID="central-display-name"
          value={displayName}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
          {error}
        </Text>
      ) : null}
      {submitting ? <ActivityIndicator color={theme.colors.primary} /> : null}
      <ActionButton
        disabled={submitting}
        label={submitting ? 'Checking connection…' : 'Connect project'}
        onPress={connect}
        testID="connect-project"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {},
  field: { gap: 5 },
  label: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    paddingVertical: 11,
  },
  error: {},
});
