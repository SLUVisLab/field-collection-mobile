import { Text } from 'react-native';

import { Screen } from '../../components/Screen.js';
import { NavButton } from '../../components/NavButton.js';
import { ROUTES } from '../../navigation/routes.js';
import { useActiveProject } from '../../context/GatherContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

/**
 * Project shell root. Shown when a project is active; the hub for the form
 * catalog, drafts, and project switching.
 */
export function ProjectHome() {
  const activeProject = useActiveProject();
  const name = activeProject?.displayName ?? 'Project';
  const theme = useTheme();
  return (
    <Screen screenId="project-home" title={name} subtitle="Active project">
      <Text style={{ color: theme.colors.textMuted, fontSize: tokens.typography.body }}>
        {activeProject?.baseUrl ? `Connected to ${activeProject.baseUrl}` : 'Connected'}
      </Text>
      <NavButton to={ROUTES.project.forms} label="Forms" testID="go-forms" />
      <NavButton to={ROUTES.project.fieldwork} label="Fieldwork" testID="go-fieldwork" />
      <NavButton to={ROUTES.project.segmentMeasure} label="Segment & Measure" testID="go-segment-measure" />
      <NavButton to={ROUTES.project.drafts} label="Drafts & submissions" testID="go-drafts" />
      <NavButton to={ROUTES.project.switch} label="Switch project" testID="go-switch" />
    </Screen>
  );
}
