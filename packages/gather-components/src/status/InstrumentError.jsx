import { Button } from '../actions/Button.jsx';
import { Heading, Helper, Panel } from '../primitives.jsx';

export function InstrumentError({ message, onRetake }) {
  return (
    <Panel tone="error">
      <Heading tone="error">Unable to complete analysis</Heading>
      <Helper tone="error">{message || 'The requested capability could not complete.'}</Helper>
      <Button label="Retake" variant="secondary" onPress={onRetake} testID="segment-measure-retake" />
    </Panel>
  );
}
