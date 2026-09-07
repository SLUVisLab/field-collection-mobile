import { useXFormsChoices, useXFormsQuestion } from 'odk-xforms-react';

import { ChoiceList } from '../../components/forms/ChoiceList.js';
import { FormField } from '../../components/forms/FormField.js';
import { ReadonlyValue } from '../../components/forms/ReadonlyValue.js';

const selectedValues = (value) => (Array.isArray(value) ? value.map(String) : []);

export function XFormsSelectControl({ node, indent, onLayout }) {
  const question = useXFormsQuestion(node.reference);
  const choices = useXFormsChoices(node.reference);
  const label = node.label ?? node.reference;

  if (question.readonly) {
    return (
      <FormField label={label} indent={indent} onLayout={onLayout}>
        <ReadonlyValue value={question.value} />
      </FormField>
    );
  }

  const multiple = node.selectType === 'select';
  return (
    <FormField
      label={label}
      hint={node.hint}
      required={question.required === true}
      indent={indent}
      onLayout={onLayout}
    >
      <ChoiceList
        choices={choices.choices}
        selectedValues={selectedValues(choices.value)}
        multiple={multiple}
        onChange={choices.setValue}
        testIDForChoice={(value) => `choice-${node.reference}-${value}`}
      />
    </FormField>
  );
}
