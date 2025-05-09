import React from 'react';
import { render } from '@testing-library/react-native';
import TextTask from '../TextTask';
import TextAction from '../TextAction';
import TextSetup from '../TextSetup';

describe('TextTask', () => {
  test('exists with correct typeID', () => {
    expect(TextTask).toBeDefined();
    expect(TextTask.typeID).toBe(2);
  });
});