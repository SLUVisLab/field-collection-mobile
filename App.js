import { useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeRouter } from 'react-router-native';

import { GatherProvider } from './src/context/GatherProvider.js';
import { useGather } from './src/context/GatherContext.js';
import { AppNavigator } from './src/navigation/AppNavigator.js';
import { initialEntryForShell } from './src/navigation/routes.js';
import { tokens } from './src/theme/tokens.js';
import { useTheme } from './src/theme/useTheme.js';

export default function App() {
  return (
    <GatherProvider>
      <GatherApplication />
    </GatherProvider>
  );
}

function GatherApplication() {
  const { status, error, shell } = useGather();
  const initialEntryRef = useRef(null);
  const theme = useTheme();
  const statusBarStyle = theme.mode === 'dark' ? 'light' : 'dark';

  if (status === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]} testID="app-loading">
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.muted, { color: theme.colors.textMuted, fontSize: tokens.typography.helper }]}>Starting Gather…</Text>
        <StatusBar style={statusBarStyle} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]} testID="app-error">
        <Text style={[styles.errorTitle, { color: theme.colors.danger, fontSize: tokens.typography.heading }]}>Gather couldn’t start</Text>
        <Text style={[styles.muted, { color: theme.colors.textMuted, fontSize: tokens.typography.helper }]}>{error?.message ?? 'Unknown error'}</Text>
        <StatusBar style={statusBarStyle} />
      </View>
    );
  }

  if (initialEntryRef.current === null) {
    initialEntryRef.current = initialEntryForShell(shell);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]} testID={`app-ready-${Platform.OS}`}>
      <NativeRouter initialEntries={[initialEntryRef.current]}>
        <AppNavigator shell={shell} />
      </NativeRouter>
      <StatusBar style={statusBarStyle} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  muted: { textAlign: 'center' },
  errorTitle: { fontWeight: '700' },
});
