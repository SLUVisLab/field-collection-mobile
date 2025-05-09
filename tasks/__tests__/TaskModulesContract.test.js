/**
 * TaskModulesContract.test.js
 * 
 * This test suite validates that all task modules registered in TaskManifest
 * conform to the expected interface and contract. It ensures consistency across
 * the task module system by verifying that:
 * 
 * - All task types have unique typeIDs
 * - Each task properly extends the base Task class
 * - All required static properties are defined and valid
 * - Each task has a proper icon component
 * - Tasks correctly initialize with constructor parameters
 * 
 * This helps maintain a reliable plugin architecture and serves as documentation
 * for developers creating new task types.
 */

import Task from '../Task';
import TaskManifest from '../tasks/TaskManifest';

describe('Task Contract Tests', () => {
  // Get all registered tasks from the manifest
  const taskTypes = Object.values(TaskManifest.taskTypes);
  
  // Check for duplicate typeIDs
  test('all tasks have unique typeIDs', () => {
    const typeIDs = taskTypes.map(taskType => taskType.typeID);
    const uniqueTypeIDs = new Set(typeIDs);
    
    expect(uniqueTypeIDs.size).toBe(typeIDs.length);
    
    // Identify any duplicates for better error messages
    const duplicates = typeIDs.filter((id, index) => typeIDs.indexOf(id) !== index);
    if (duplicates.length > 0) {
      console.error('Duplicate typeIDs found:', duplicates);
    }
  });
  
  // Test each registered task type individually
  taskTypes.forEach(TaskType => {
    describe(`${TaskType.typeDisplayName} (typeID: ${TaskType.typeID})`, () => {
      test('extends Task class', () => {
        const instance = new TaskType('test-id', 'Test Task', 'testData', 'Instructions', {});
        expect(instance).toBeInstanceOf(Task);
      });
      
      test('has required static properties', () => {
        expect(TaskType.typeID).toBeDefined();
        expect(typeof TaskType.typeID).toBe('number');
        
        expect(TaskType.typeDisplayName).toBeDefined();
        expect(typeof TaskType.typeDisplayName).toBe('string');
        expect(TaskType.typeDisplayName.length).toBeGreaterThan(0);
        
        expect(TaskType.typeDescription).toBeDefined();
        expect(typeof TaskType.typeDescription).toBe('string');
        expect(TaskType.typeDescription.length).toBeGreaterThan(0);
        
        expect(TaskType.setupViewPath).toBeDefined();
        expect(TaskType.actionViewPath).toBeDefined();
      });
      
      test('has a valid icon component', () => {
        expect(TaskType.typeIcon).toBeDefined();
        expect(typeof TaskType.typeIcon).toBe('function');
      });
      
      test('properly initializes with constructor parameters', () => {
        const taskID = `test-${TaskType.typeID}`;
        const displayName = `Test ${TaskType.typeDisplayName}`;
        const dataLabel = 'testData';
        const instructions = 'Test instructions';
        const options = { testOption: true };
        
        const instance = new TaskType(taskID, displayName, dataLabel, instructions, options);
        
        expect(instance.taskID).toBe(taskID);
        expect(instance.taskDisplayName).toBe(displayName);
        expect(instance.dataLabel).toBe(dataLabel);
        expect(instance.instructions).toBe(instructions);
        expect(instance.options).toEqual(options);
      });
    });
  });
});