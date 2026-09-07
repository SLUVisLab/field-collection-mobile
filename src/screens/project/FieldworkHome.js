import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useNavigate } from 'react-router-native';
import { Screen } from '../../components/Screen.js';
import { ActionButton, NavButton } from '../../components/NavButton.js';
import { useGather } from '../../context/GatherContext.js';
import { useTheme } from '../../theme/useTheme.js';

export function FieldworkHome() {
  const { activeProject, actions } = useGather();
  const navigate = useNavigate();
  const theme = useTheme();
  const [sessions, setSessions] = useState([]);
  const [forms, setForms] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const load = useCallback(async () => {
    if (!activeProject) return;
    const [nextSessions, cachedForms] = await Promise.all([actions.listFieldworkSessions(), actions.listCachedForms()]);
    const entityForms = [];
    for (const form of cachedForms) {
      const cached = await actions.loadCachedForm(form.formId);
      const dataset = cached.version.resources.find((resource) => resource.isEntityList && resource.entityDataset)?.entityDataset;
      if (dataset) entityForms.push({ ...form, dataset });
    }
    setSessions(nextSessions);
    setForms(entityForms);
  }, [activeProject, actions]);
  useEffect(() => { void load().catch(() => setMessage('Could not load local fieldwork sessions.')); }, [load]);
  const start = async (form) => {
    setBusy(true); setMessage(null);
    try {
      const session = await actions.startFieldworkSession({
        formId: form.formId, dataset: form.dataset, sorting: [{ property: 'label', direction: 'asc' }],
      });
      navigate(`/project/fieldwork/${encodeURIComponent(session.sessionId)}`);
    } catch (error) {
      setMessage(error?.message ?? 'Could not start fieldwork.');
    } finally { setBusy(false); }
  };
  return (
    <Screen screenId="project-fieldwork" title="Fieldwork" subtitle="Traverse downloaded Entity sets" canGoBack>
      {message ? <Text style={{ color: theme.colors.danger }}>{message}</Text> : null}
      <Text style={{ color: theme.colors.textMuted }}>Sessions are local, resumable workflows. Normal Forms remain available independently.</Text>
      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Start fieldwork</Text>
      {forms.length === 0 ? <Text style={{ color: theme.colors.textMuted }}>Download an Entity-aware form first.</Text> : null}
      {forms.map((form) => <View key={form.formId}><Text style={{ color: theme.colors.text }}>{form.displayName}</Text><ActionButton onPress={() => void start(form)} disabled={busy} label={busy ? 'Starting…' : 'Start session'} /></View>)}
      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Resume session</Text>
      {sessions.map((session) => <NavButton key={session.sessionId} to={`/project/fieldwork/${encodeURIComponent(session.sessionId)}`} label={`${session.formId} · ${session.targetEntityIds.length} targets`} />)}
      {busy ? <ActivityIndicator color={theme.colors.primary} /> : null}
    </Screen>
  );
}
