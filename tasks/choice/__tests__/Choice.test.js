import React from 'react';
import { render } from '@testing-library/react-native';
import ChoiceTask from '../ChoiceTask';
import ChoiceAction from '../ChoiceAction';
import { ChoiceSetup } from '../ChoiceSetup';

describe('ChoiceTask', () => {
    test('exists with correct typeID', () => {
      expect(ChoiceTask).toBeDefined();
      expect(ChoiceTask.typeID).toBe(4);
    });
  });