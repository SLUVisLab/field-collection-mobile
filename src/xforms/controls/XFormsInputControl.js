import { useXFormsQuestion } from 'odk-xforms-react';

import { FormField } from '../../components/forms/FormField.js';
import { ReadonlyValue } from '../../components/forms/ReadonlyValue.js';
import { TextField } from '../../components/forms/TextField.js';

const keyboardTypeFor = (valueType) =>
  valueType === 'int' ? 'number-pad' : valueType === 'decimal' ? 'decimal-pad' : 'default';

export function XFormsInputControl({ node, indent, onLayout }) {
  const question = useXFormsQuestion(node.reference);
  const label = node.label ?? node.reference;

  if (question.readonly) {
    return (
      <FormField label={label} indent={indent} onLayout={onLayout}>
        <ReadonlyValue value={question.value} />
      </FormField>
    );
  }

  return (
    <FormField
      label={label}
      hint={node.hint}
      required={question.required === true}
      indent={indent}
      onLayout={onLayout}
    >
      <TextField
        value={question.value}
        onChange={question.setValue}
        keyboardType={keyboardTypeFor(node.valueType)}
        error={question.valid === false ? 'This value does not meet the form constraint.' : null}
        testID={`field-${node.reference}`}
      />
    </FormField>
  );
}
