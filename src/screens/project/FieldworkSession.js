import { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useNavigate, useParams, useSearchParams } from 'react-router-native';
import { Screen } from '../../components/Screen.js';
import { ActionButton } from '../../components/NavButton.js';
import { EntityListItem } from '../../components/entities/EntityListItem.js';
import { GatherMap } from '../../components/maps/GatherMap.js';
import { useGather } from '../../context/GatherContext.js';
import { useTheme } from '../../theme/useTheme.js';

const markerColor = (state, theme) => state === 'draft' ? theme.colors.primary : state === 'pending' ? theme.colors.danger : theme.colors.success;

export function FieldworkSession() {
  const { sessionId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { actions } = useGather();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [groupProperty, setGroupProperty] = useState('');
  const load = useCallback(async () => setData(await actions.getFieldworkSession(sessionId)), [actions, sessionId]);
  useEffect(() => { void load(); }, [load]);
  const session = data?.session;
  const traversal = data?.traversal;
  useEffect(() => {
    if (!session || !traversal || searchParams.get('next') !== '1') return;
    const next = traversal.entities.find((entity) => entity.state === 'pending');
    if (!next) return;
    void (async () => {
      await actions.updateFieldworkSession(session.sessionId, { currentEntityId: next.entityId });
      navigate(`/project/forms/${encodeURIComponent(session.formId)}?fieldworkSession=${encodeURIComponent(session.sessionId)}&entityId=${encodeURIComponent(next.entityId)}`, { replace: true });
    })();
  }, [actions, navigate, searchParams, session, traversal]);
  if (!data) return <Screen screenId="fieldwork-session" title="Fieldwork" canGoBack><Text>Loading session…</Text></Screen>;
  const shown = traversal.entities.filter((entity) => `${entity.label} ${entity.entityId}`.toLowerCase().includes(search.toLowerCase()));
  const select = async (entityId) => {
    setSelected(entityId);
    await actions.updateFieldworkSession(session.sessionId, { currentEntityId: entityId });
    await load();
  };
  const active = traversal.entities.find((entity) => entity.entityId === selected || entity.entityId === session.currentEntityId) ?? null;
  const observe = () => active && navigate(
    active.instance?.state === 'draft'
      ? `/project/drafts/${encodeURIComponent(active.instance.localInstanceId)}/fill`
      : `/project/forms/${encodeURIComponent(session.formId)}?fieldworkSession=${encodeURIComponent(session.sessionId)}&entityId=${encodeURIComponent(active.entityId)}`
  );
  const setView = async (viewMode) => { await actions.updateFieldworkSession(session.sessionId, { viewMode }); await load(); };
  const applyFilter = async () => {
    await actions.updateFieldworkSession(session.sessionId, { filters: search ? { label: search } : {} });
    await load();
  };
  const applyGrouping = async () => {
    await actions.updateFieldworkSession(session.sessionId, { grouping: groupProperty ? { property: groupProperty } : {} });
    await load();
  };
  const toggleSort = async () => {
    const direction = session.sorting?.[0]?.direction === 'asc' ? 'desc' : 'asc';
    await actions.updateFieldworkSession(session.sessionId, { sorting: [{ property: 'label', direction }] });
    await load();
  };
  return (
    <Screen screenId="fieldwork-session" title="Fieldwork session" subtitle={`${traversal.counts.complete + traversal.counts.sent}/${traversal.entities.length} locally complete`} canGoBack>
      <Text style={{ color: theme.colors.text }}>{session.formId} · {session.entityDataset}</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Filter labels" style={{ borderColor: theme.colors.border, borderWidth: 1, color: theme.colors.text, padding: 10 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}><ActionButton label="Apply filter" onPress={() => void applyFilter()} /><ActionButton label={`Sort label ${session.sorting?.[0]?.direction === 'desc' ? 'Z-A' : 'A-Z'}`} onPress={() => void toggleSort()} /></View>
      <TextInput value={groupProperty} onChangeText={setGroupProperty} placeholder="Group by property (for example, site)" style={{ borderColor: theme.colors.border, borderWidth: 1, color: theme.colors.text, padding: 10 }} />
      <ActionButton label="Apply grouping" onPress={() => void applyGrouping()} />
      <View style={{ flexDirection: 'row', gap: 8 }}><ActionButton label="List" onPress={() => void setView('list')} /><ActionButton label="Groups" onPress={() => void setView('groups')} /><ActionButton label="Map" onPress={() => void setView('map')} /></View>
      {session.viewMode === 'groups' ? traversal.groups.map((group) => <View key={group.name}><Text style={{ color: theme.colors.text, fontWeight: '700' }}>{group.name}</Text>{group.entities.map((entity) => <EntityListItem key={entity.entityId} entity={entity} selected={active?.entityId === entity.entityId} onPress={() => void select(entity.entityId)} actionLabel={entity.state === 'draft' ? 'Resume' : 'Observe'} />)}</View>) : null}
      {session.viewMode === 'map' ? <GatherMap centerCoordinate={shown.find((entity) => entity.geometry)?.geometry?.coordinates ?? [-90.5582, 38.5242]} points={shown.filter((entity) => entity.geometry).map((entity) => ({ id: entity.entityId, coordinate: entity.geometry.coordinates, color: markerColor(entity.state, theme) }))} onSelectPoint={(entityId) => void select(entityId)} /> : null}
      {session.viewMode !== 'groups' && session.viewMode !== 'map' ? shown.map((entity) => <EntityListItem key={entity.entityId} entity={entity} selected={active?.entityId === entity.entityId} onPress={() => void select(entity.entityId)} actionLabel={entity.state === 'draft' ? 'Resume' : 'Observe'} />) : null}
      {active ? <ActionButton label={active.state === 'draft' ? 'Resume observation' : 'Observe'} onPress={observe} /> : <Text style={{ color: theme.colors.textMuted }}>Select an Entity to begin.</Text>}
    </Screen>
  );
}
