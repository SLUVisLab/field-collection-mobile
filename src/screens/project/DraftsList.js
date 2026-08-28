import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../components/Screen.js';
import { ActionButton, NavButton } from '../../components/NavButton.js';
import { useGather } from '../../context/GatherContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

const stateLabel = (state) => ({ draft: 'Draft', ready: 'Ready to send', sent: 'Sent' }[state] ?? state);

/**
 * The list is deliberately local-only until a user presses Send all. No mount,
 * refresh, or retry path starts network work in the background.
 */
export function DraftsList() {
  const { activeProject, actions } = useGather();
  const { listInstances, sendAllReadyInstances } = actions;
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const theme = useTheme();

  const refresh = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      setInstances(await listInstances());
    } catch {
      setMessage('Could not read saved instances.');
    } finally {
      setLoading(false);
    }
  }, [activeProject, listInstances]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendAll = async () => {
    setSending(true);
    setMessage(null);
    try {
      const results = await sendAllReadyInstances();
      const sent = results.filter((result) => result.ok).length;
      const failed = results.length - sent;
      setMessage(failed ? `${sent} sent; ${failed} still ready to retry.` : `${sent} instance(s) sent.`);
      await refresh();
    } catch {
      setMessage('Could not start sending saved instances.');
    } finally {
      setSending(false);
    }
  };

  const readyCount = instances.filter((instance) => instance.state === 'ready').length;
  return (
    <Screen
      screenId="project-drafts"
      title="Drafts & submissions"
      subtitle="Saved XML instances for this project"
      canGoBack
    >
      <Text style={[styles.note, { color: theme.colors.textMuted, lineHeight: tokens.typography.bodyLineHeight }]}>
        Drafts stay on this device. Sending happens only when you explicitly choose Send.
      </Text>
      <ActionButton
        onPress={sendAll}
        label={sending ? 'Sending…' : `Send all ready (${readyCount})`}
        disabled={sending || readyCount === 0}
        testID="send-all-ready"
      />
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {message ? <Text style={[styles.message, { color: theme.colors.text, lineHeight: tokens.typography.bodyLineHeight }]}>{message}</Text> : null}
      {!loading && instances.length === 0 ? (
        <Text style={[styles.note, { color: theme.colors.textMuted, lineHeight: tokens.typography.bodyLineHeight }]}>
          No saved instances yet.
        </Text>
      ) : null}
      {instances.map((instance) => (
        <View key={instance.localInstanceId} style={[styles.instance, { borderTopColor: theme.colors.border, gap: tokens.spacing.sm, paddingTop: tokens.spacing.lg }]}>
          <Text style={[styles.formName, { color: theme.colors.text, fontSize: tokens.typography.body + 1 }]}>{instance.formId}</Text>
          <Text style={[styles.detail, { color: theme.colors.textMuted, fontSize: tokens.typography.helper }]}>
            {stateLabel(instance.state)}
            {instance.formVersion ? ` · Version ${instance.formVersion}` : ''}
          </Text>
          {instance.sendError ? (
            <Text style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.helperLineHeight }]}>
              {instance.sendError}
            </Text>
          ) : null}
          <NavButton
            to={`/project/drafts/${encodeURIComponent(instance.localInstanceId)}`}
            label="View instance"
            testID={`open-instance-${instance.localInstanceId}`}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {},
  message: {},
  instance: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  formName: { fontWeight: '700' },
  detail: {},
  error: {},
});
