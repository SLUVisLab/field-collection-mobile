import React from 'react';
import { render } from '@testing-library/react-native';
import GeoPointTask from '../GeoPointTask';
import GeoPointAction from '../GeoPointAction';
import GeoPointSetup from '../GeoPointSetup';

describe('GeoPointTask', () => {
  test('exists with correct typeID', () => {
    expect(GeoPointTask).toBeDefined();
    expect(GeoPointTask.typeID).toBe(7);
  });
});