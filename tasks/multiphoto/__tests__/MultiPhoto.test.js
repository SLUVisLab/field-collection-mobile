import React from 'react';
import { render } from '@testing-library/react-native';
import MultiPhotoTask from '../MultiPhotoTask';
import MultiPhotoAction from '../MultiPhotoAction';
import MultiPhotoSetup from '../MultiPhotoSetup';

describe('MultiPhotoTask', () => {
  test('exists with correct typeID', () => {
    expect(MultiPhotoTask).toBeDefined();
    expect(MultiPhotoTask.typeID).toBe(6);
  });
});