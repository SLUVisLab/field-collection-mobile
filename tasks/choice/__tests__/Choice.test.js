import React from 'react';
import { render } from '@testing-library/react-native';
import BarcodeTask from '../BarcodeTask';
import BarcodeAction from '../BarcodeAction';
import { BarcodeSetup } from '../BarcodeSetup';

describe('BarcodeTask', () => {
    test('exists with correct typeID', () => {
      expect(BarcodeTask).toBeDefined();
      expect(BarcodeTask.typeID).toBe(8);
    });
  });