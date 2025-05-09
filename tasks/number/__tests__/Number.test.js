import React from 'react';
import { render } from '@testing-library/react-native';
import NumberTask from '../NumberTask';
import NumberAction from '../NumberAction';
import NumberSetup from '../NumberSetup';

describe('NumberTask', () => {
  test('exists with correct typeID', () => {
    expect(NumberTask).toBeDefined();
    expect(NumberTask.typeID).toBe(3);
  });
});