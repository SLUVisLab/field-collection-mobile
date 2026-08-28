import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../components/Screen.js';
import { ActionButton, NavButton } from '../../components/NavButton.js';
import { useGather } from '../../context/GatherContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

/**
 * Local catalog only: no network activity happens on mount. Central refresh is
 * an explicit user action, keeping cached forms available offline.
 */
export function FormCatalog() {
  const { activeProject, actions } = useGather();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);
  const theme = useTheme();

  const loadCached = useCallback(async () => {
    if (!activeProject?.projectKey) return;
    setLoading(true);
    try {
      setForms(await actions.listCachedForms(activeProject.projectKey));
    } catch {
      setMessage('Could not read downloaded forms.');
    } finally {
      setLoading(false);
    }
  }, [activeProject?.projectKey, actions]);

  useEffect(() => {
    void loadCached();
  }, [loadCached]);

  const refresh = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const result = await actions.refreshForms();
      await loadCached();
      setMessage(
        result.failures.length
          ? `${result.refreshed.length} form(s) refreshed; ${result.failures.length} could not be cached.`
          : `${result.refreshed.length} form(s) refreshed.`
      );
    } catch {
      setMessage('Could not refresh forms. Check the Central connection and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen
      screenId="project-forms"
      title="Forms"
      subtitle="Downloaded forms for this project"
      canGoBack
    >
      <Text style={[styles.note, { color: theme.colors.textMuted, lineHeight: tokens.typography.bodyLineHeight }]}>
        Refresh downloads form definitions and resources for offline use. Gather does not refresh in
        the background.
      </Text>
      <ActionButton
        onPress={refresh}
        label={refreshing ? 'Refreshing forms…' : 'Refresh forms'}
        disabled={refreshing}
        testID="refresh-forms"
      />
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {message ? <Text style={[styles.message, { color: theme.colors.text, lineHeight: tokens.typography.bodyLineHeight }]}>{message}</Text> : null}
      {!loading && forms.length === 0 ? (
        <Text style={[styles.note, { color: theme.colors.textMuted, lineHeight: tokens.typography.bodyLineHeight }]}>No forms are downloaded yet.</Text>
      ) : null}
      {forms.map((form) => (
        <View key={form.formKey} style={[styles.form, { borderTopColor: theme.colors.border, gap: tokens.spacing.sm, paddingTop: tokens.spacing.lg }]}>
          <Text style={[styles.formName, { color: theme.colors.text, fontSize: tokens.typography.body + 1 }]}>{form.displayName}</Text>
          <Text style={[styles.detail, { color: theme.colors.textMuted, fontSize: tokens.typography.helper }]}>
            {form.remoteVersion ? `Version ${form.remoteVersion}` : 'Unversioned'} ·{' '}
            {form.resourceCount} resource{form.resourceCount === 1 ? '' : 's'}
          </Text>
          <NavButton
            to={`/project/forms/${encodeURIComponent(form.formId)}`}
            label="Fill out form"
            testID={`open-form-${form.formId}`}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {},
  message: {},
  form: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  formName: { fontWeight: '700' },
  detail: {},
});
