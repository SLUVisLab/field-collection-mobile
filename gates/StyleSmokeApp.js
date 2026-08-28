import { useEffect } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { NativeRouter } from 'react-router-native';

import { ActionButton, NavButton } from '../src/components/NavButton.js';
import { ChoiceList } from '../src/components/forms/ChoiceList.js';
import { FormField } from '../src/components/forms/FormField.js';
import { TextField } from '../src/components/forms/TextField.js';
import { useTheme } from '../src/theme/useTheme.js';

export default function StyleSmokeApp() {
  return (
    <NativeRouter>
      <StyleSmokeContent />
    </NativeRouter>
  );
}

function StyleSmokeContent() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  useEffect(() => {
    console.log(`STYLE_SMOKE_RESULT::${theme.mode}:${colorScheme ?? 'null'}`);
  }, [colorScheme, theme.mode]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Gather style smoke</Text>
      <Text style={[styles.note, { color: theme.colors.textMuted }]}>
        Field-sized actions, form controls, and selected choices.
      </Text>
      <ActionButton label="Primary action" onPress={() => {}} testID="style-primary" />
      <ActionButton label="Secondary action" variant="secondary" onPress={() => {}} testID="style-secondary" />
      <ActionButton label="Danger action" tone="danger" onPress={() => {}} testID="style-danger" />
      <FormField label="Observation" hint="A scalable form field">
        <TextField value="" onChange={() => {}} testID="style-input" />
      </FormField>
      <ChoiceList
        choices={[{ value: 'selected', label: 'Selected choice' }]}
        selectedValues={['selected']}
        onChange={() => {}}
        testIDForChoice={() => 'style-choice'}
      />
      <NavButton label="Navigation row" to="/" testID="style-nav" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12, padding: 20, paddingTop: 64 },
  title: { fontSize: 24, fontWeight: '700' },
  note: { fontSize: 16, lineHeight: 22 },
});
