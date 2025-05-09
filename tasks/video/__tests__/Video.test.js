import React from 'react';
import { render } from '@testing-library/react-native';
import VideoTask from '../VideoTask';
import VideoAction from '../VideoAction';
import VideoSetup from '../VideoSetup';

describe('VideoTask', () => {
  test('exists with correct typeID', () => {
    expect(VideoTask).toBeDefined();
    expect(VideoTask.typeID).toBe(5);
  });
});