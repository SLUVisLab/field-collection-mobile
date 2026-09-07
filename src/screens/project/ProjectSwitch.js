import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Screen } from '../../components/Screen.js';
import { ActionButton } from '../../components/NavButton.js';
import { useActiveProject, useGather } from '../../context/GatherContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function ProjectSwitch() {
  const activeProject = useActiveProject();
  const { actions } = useGather();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [busyProjectKey, setBusyProjectKey] = useState(null);
  const theme = useTheme();

  const load = useCallback(async () => {
    try {
      setProjects(await actions.listProjects());
    } catch {
      setError('Gather could not load saved projects.');
    }
  }, [actions]);

  useEffect(() => {
    load();
  }, [load]);

  const switchProject = async (projectKey) => {
    setBusyProjectKey(projectKey);
    setError(null);
    try {
      await actions.switchProject(projectKey);
      await load();
    } catch (cause) {
      setError(
        cause?.code?.startsWith('GATHER_') ? cause.message : 'Gather could not switch projects.'
      );
    } finally {
      setBusyProjectKey(null);
    }
  };

  const removeProject = async (projectKey) => {
    setBusyProjectKey(projectKey);
    setError(null);
    try {
      await actions.removeProject(projectKey, { confirmed: true });
      await load();
    } catch (cause) {
      setError(
        cause?.code?.startsWith('GATHER_') ? cause.message : 'Gather could not remove this project.'
      );
    } finally {
      setBusyProjectKey(null);
    }
  };

  const confirmRemove = async (project) => {
    setError(null);
    try {
      const preview = await actions.getRemovalPreview(project.projectKey);
      Alert.alert(
        `Remove ${project.displayName}?`,
        `${preview.warning}\n\nThis deletes the project connection, its files, and its saved credentials.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove project',
            style: 'destructive',
            onPress: () => {
              void removeProject(project.projectKey);
            },
          },
        ]
      );
    } catch (cause) {
      setError(
        cause?.code?.startsWith('GATHER_')
          ? cause.message
          : 'Gather could not prepare project removal.'
      );
    }
  };

  const addProject = async () => {
    try {
      await actions.clearActiveProject();
    } catch {
      setError('Gather could not open project setup.');
    }
  };

  return (
    <Screen
      screenId="project-switch"
      title="Switch project"
      subtitle="Choose or add a project"
      canGoBack
    >
      {projects.length === 0 ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: tokens.typography.body }}>No other projects registered.</Text>
      ) : (
        projects.map((project) => (
          <View key={project.projectKey} style={{ gap: 4 }}>
            <ActionButton
              label={`${project.displayName}${
                project.projectKey === activeProject?.projectKey ? ' (active)' : ''
              }`}
              disabled={busyProjectKey !== null}
              onPress={() => switchProject(project.projectKey)}
              testID={`switch-${project.projectKey}`}
            />
            <ActionButton
              disabled={busyProjectKey !== null}
              label={busyProjectKey === project.projectKey ? 'Working…' : 'Remove project'}
              onPress={() => confirmRemove(project)}
              testID={`remove-${project.projectKey}`}
              tone="danger"
            />
          </View>
        ))
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger, lineHeight: tokens.typography.bodyLineHeight }}>
          {error}
        </Text>
      ) : null}
      <ActionButton label="Add another project" onPress={addProject} testID="go-add-project" />
      <ActionButton
        label="Disconnect (return to setup)"
        tone="danger"
        onPress={() => actions.clearActiveProject()}
        testID="disconnect-project"
      />
    </Screen>
  );
}
