import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { QrScanner } from '../../components/camera/QrScanner.js';
import { Screen } from '../../components/Screen.js';
import { ActionButton } from '../../components/NavButton.js';
import { useGather } from '../../context/GatherContext.js';
import { tokens } from '../../theme/tokens.js';
import { useTheme } from '../../theme/useTheme.js';

export function SetupScan() {
  const { actions } = useGather();
  const [qrText, setQrText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [scanActive, setScanActive] = useState(true);
  const claimedScan = useRef(false);
  const theme = useTheme();

  const provisionQr = useCallback(async (rawQrText, { resumeScanner = false } = {}) => {
    let provisioned = false;
    setSubmitting(true);
    setError(null);
    try {
      await actions.provisionQr(rawQrText);
      setQrText('');
      provisioned = true;
    } catch (cause) {
      setError(
        cause?.code?.startsWith('GATHER_')
          ? cause.message
          : 'Gather could not import this Settings QR code.'
      );
    } finally {
      setSubmitting(false);
      if (resumeScanner && !provisioned) {
        claimedScan.current = false;
        setScanActive(true);
      }
    }
  }, [actions]);

  const importQr = useCallback(() => {
    void provisionQr(qrText);
  }, [provisionQr, qrText]);

  const importScannedQr = useCallback(
    (rawQrText) => {
      if (submitting || claimedScan.current) return;
      claimedScan.current = true;
      setScanActive(false);
      void provisionQr(rawQrText, { resumeScanner: true });
    },
    [provisionQr, submitting]
  );

  return (
    <Screen
      screenId="setup-scan"
      title="Import a Settings QR code"
      subtitle="Provision an ODK Central App User project"
      canGoBack
    >
      <Text style={[styles.note, { color: theme.colors.textMuted, lineHeight: tokens.typography.bodyLineHeight }]}>
        Scan an ODK Collect Settings QR code. Gather imports only Central App User project settings
        and does not save the QR code itself.
      </Text>
      <QrScanner
        isActive={scanActive && !submitting}
        onCode={importScannedQr}
        onError={() => {
          setScanActive(false);
          setError('Camera scanning is unavailable. Paste the Settings QR content below.');
        }}
      />
      <Text style={[styles.fallbackTitle, { color: theme.colors.text, fontSize: tokens.typography.body }]}>Paste fallback</Text>
      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.colors.text, fontSize: tokens.typography.helper }]}>Settings QR content</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          onChangeText={setQrText}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          style={[
            styles.input,
            styles.qrInput,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
              borderRadius: tokens.radii.sm,
              color: theme.colors.text,
              fontSize: tokens.typography.body,
              paddingHorizontal: tokens.spacing.md,
            },
          ]}
          testID="settings-qr-content"
          value={qrText}
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
        label={submitting ? 'Checking connection…' : 'Import project'}
        onPress={importQr}
        testID="import-settings-qr"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {},
  fallbackTitle: { fontWeight: '700', marginTop: 4 },
  field: { gap: 5 },
  label: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    paddingVertical: 11,
  },
  qrInput: { minHeight: 96, textAlignVertical: 'top' },
  error: {},
});
