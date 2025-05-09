/**
 * TaskActionContract.test.js
 * 
 * This test suite validates that all task action components registered in TaskManifest
 * conform to the expected interface and contract requirements. It ensures:
 * 
 * - Each task has a valid action component registered in TaskManifest
 * - Action components correctly accept the required props
 * - Components reference onComplete in their implementation
 * - Components handle existingData in their implementation
 * 
 * This serves as documentation for developers creating new task types.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import TaskManifest from '../TaskManifest';

// Basic mocks for components that might cause issues in tests
jest.mock('expo-camera', () => ({
  Camera: 'Camera',
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
  useMicrophonePermissions: () => [{ granted: true }, jest.fn()],
}));

jest.mock('expo-av', () => ({
  Video: 'Video',
}));

jest.mock('react-native-maps', () => 'MapView');

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 37.7749, longitude: -122.4194 }
  }))
}));

describe('Task Action Components Contract Tests', () => {
  // Get all task entries from manifest
  const taskEntries = Object.entries(TaskManifest);
  
  test('all TaskManifest entries include a taskAction component', () => {
    taskEntries.forEach(([typeID, entry]) => {
      expect(entry.taskAction).toBeDefined();
      expect(typeof entry.taskAction).toBe('function');
    });
  });
  
  test('component source code references onComplete and existingData', () => {
    taskEntries.forEach(([typeID, entry]) => {
      const { taskAction: ActionComponent, taskModule: TaskModule } = entry;
      
      // Convert component function to string and check for required props
      const componentSource = ActionComponent.toString();
      
      // Check for onComplete usage
      const usesOnComplete = componentSource.includes('onComplete');
      expect(usesOnComplete).toBe(true);
      if (!usesOnComplete) {
        console.error(`${TaskModule.typeDisplayName} does not reference onComplete in its code`);
      }
      
      // Check for existingData usage
      const usesExistingData = componentSource.includes('existingData');
      expect(usesExistingData).toBe(true);
      if (!usesExistingData) {
        console.error(`${TaskModule.typeDisplayName} does not check for existingData in its code`);
      }
    });
  });
  
  // Test each task action component
  taskEntries.forEach(([typeID, entry]) => {
    const { taskAction: ActionComponent, taskModule: TaskModule } = entry;
    
    describe(`${TaskModule.typeDisplayName} Action Component (typeID: ${typeID})`, () => {
      // Create standard props that all components should accept
      const mockTask = {
        taskID: 'test-task-id',
        dataLabel: 'testData',
        instructions: 'Test instructions',
        options: {}
      };
      
      const mockItem = { name: 'Test Item' };
      const mockCollection = { name: 'Test Collection', parentName: 'Parent Collection' };
      const mockOnComplete = jest.fn();
      
      test('renders without errors with required props', () => {
        const { container } = render(
          <ActionComponent
            existingData={null}
            onComplete={mockOnComplete}
            task={mockTask}
            item={mockItem}
            collection={mockCollection}
          />
        );
        expect(container).toBeTruthy();
      });
      
      test('renders with generic existingData prop', () => {
        // Use generic mock data for all components
        const mockData = { 
          data: { 
            [mockTask.dataLabel]: 'generic test value' 
          }
        };
        
        const { container } = render(
          <ActionComponent
            existingData={mockData}
            onComplete={mockOnComplete}
            task={mockTask}
            item={mockItem}
            collection={mockCollection}
          />
        );
        expect(container).toBeTruthy();
      });
    });
  });
});