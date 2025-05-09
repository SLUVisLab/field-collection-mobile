import React from 'react';
import { render } from '@testing-library/react-native';
import PhotoTask from '../PhotoTask';
import PhotoAction from '../PhotoAction';
import PhotoSetup from '../PhotoSetup';

describe('PhotoTask', () => {
  test('exists with correct typeID', () => {
    expect(PhotoTask).toBeDefined();
    expect(PhotoTask.typeID).toBe(1);
  });
});