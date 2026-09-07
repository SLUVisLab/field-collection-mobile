import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useNavigate, useParams } from 'react-router-native';

import { Screen } from '../../components/Screen.js';
import { ActionButton, NavButton } from '../../components/NavButton.js';
import { useGather } from '../../context/GatherContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

const stateTitle = (state) => ({ draft: 'Draft', ready: 'Ready to send', sent: 'Sent' }[state] ?? 'Instance');

export function InstanceDetail() {
  const { instanceId = '' } = useParams();
  const navigate = useNavigate();
  const { actions } = useGather();
  const { listInstances, sendInstance } = actions;
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const theme = useTheme();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const found = (await listInstances()).find((item) => item.localInstanceId === instanceId) ?? null;
      setInstance(found);
    } catch {
      setMessage('Could not read this saved instance.');
    } finally {
      setLoading(false);
    }
  }, [instanceId, listInstances]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    if (!instance || sending) return;
    setSending(true);
    setMessage(null);
    try {
      const result = await sendInstance(instance.localInstanceId);
      setInstance(result.instance);
      setMessage(
        result.ok
          ? 'Sent to Central. The XML remains on this device.'
          : result.instance.sendError ?? result.message ?? 'This instance remains ready to retry.'
      );
    } catch {
      setMessage('Could not send this instance. It remains ready to retry.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      screenId="project-instance"
      title={instance ? stateTitle(instance.state) : 'Instance'}
      subtitle={instance?.formId ?? 'Saved instance'}
      canGoBack
    >
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {message ? <Text style={[styles.message, { color: theme.colors.text, lineHeight: tokens.typography.bodyLineHeight }]}>{message}</Text> : null}
      {!loading && !instance ? (
        <>
          <Text style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
            This saved instance was not found in the active project.
          </Text>
          <ActionButton onPress={() => navigate('/project/drafts')} label="Back to saved instances" />
        </>
      ) : null}
      {instance ? (
        <>
          <Text style={[styles.detail, { color: theme.colors.textMuted, fontSize: tokens.typography.helper, lineHeight: tokens.typography.bodyLineHeight }]}>
            Form version: {instance.formVersion || 'unversioned'}
          </Text>
          <Text style={[styles.detail, { color: theme.colors.textMuted, fontSize: tokens.typography.helper, lineHeight: tokens.typography.bodyLineHeight }]}>
            Saved: {instance.updatedAt}
          </Text>
          {instance.state === 'draft' ? (
            <NavButton
              to={`/project/drafts/${encodeURIComponent(instance.localInstanceId)}/fill`}
              label="Resume draft"
              testID="resume-draft"
            />
          ) : null}
          {instance.state === 'ready' ? (
            <>
              <Text style={[styles.note, { color: theme.colors.textMuted, lineHeight: tokens.typography.bodyLineHeight }]}>
                This validated XML is ready. Sending is foreground and user-triggered.
              </Text>
              {instance.sendError ? (
                <Text style={[styles.error, { color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }]}>
                  {instance.sendError}
                </Text>
              ) : null}
              <ActionButton
                onPress={send}
                label={sending ? 'Sending…' : 'Send to Central'}
                disabled={sending}
                testID="send-instance"
              />
            </>
          ) : null}
          {instance.state === 'sent' ? (
            <>
              <Text style={[styles.success, { color: theme.colors.success, lineHeight: tokens.typography.bodyLineHeight }]}>
                Sent. The serialized XML is retained locally.
              </Text>
              {instance.sendReceipt ? (
                <Text style={[styles.detail, { color: theme.colors.textMuted, fontSize: tokens.typography.helper, lineHeight: tokens.typography.bodyLineHeight }]}>
                  {instance.sendReceipt}
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  detail: {},
  note: {},
  success: {},
  message: {},
  error: {},
});
