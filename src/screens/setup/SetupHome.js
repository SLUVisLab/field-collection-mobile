import { Text } from 'react-native';

import { Screen } from '../../components/Screen.js';
import { NavButton } from '../../components/NavButton.js';
import { ROUTES } from '../../navigation/routes.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

/**
 * Setup shell root. Shown when no project is active. Entry point to the two
 * provisioning paths (manual + QR); the provisioning logic itself lands in M5.2.
 */
export function SetupHome() {
  const theme = useTheme();

  return (
    <Screen
      screenId="setup-home"
      title="Set up Gather"
      subtitle="Connect a project to begin collecting"
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: tokens.typography.body }}>
        No project is connected yet. Add one to start.
      </Text>
      <NavButton to={ROUTES.setup.connect} label="Connect manually" testID="go-connect" />
      <NavButton to={ROUTES.setup.scan} label="Scan a QR code" testID="go-scan" />
    </Screen>
  );
}
