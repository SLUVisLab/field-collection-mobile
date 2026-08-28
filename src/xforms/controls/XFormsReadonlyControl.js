import { FormField } from '../../components/forms/FormField.js';
import { ReadonlyValue } from '../../components/forms/ReadonlyValue.js';

export function XFormsReadonlyControl({ node, value, indent, onLayout }) {
  return (
    <FormField label={node.label ?? node.reference} indent={indent} onLayout={onLayout}>
      <ReadonlyValue value={value} />
    </FormField>
  );
}
