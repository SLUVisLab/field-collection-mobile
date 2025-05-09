import fs from 'fs';
import path from 'path';
import TaskManifest from '../TaskManifest';

describe('Task Module Tests Contract', () => {
  // Get all registered task types with their display names
  const taskTypes = Object.values(TaskManifest).map(entry => ({
    name: entry.taskModule.typeDisplayName.toLowerCase(),
    module: entry.taskModule
  }));
  
  test('all task modules have test files', () => {
    // Get the base tasks directory
    const tasksDir = path.resolve(__dirname, '..');
    
    taskTypes.forEach(({ name, module }) => {
      // Look for a directory matching the task name
      const moduleDir = path.join(tasksDir, name);
      const dirExists = fs.existsSync(moduleDir);
      
      // If directory doesn't exist with lowercase name, try to find it
      let foundDir = moduleDir;
      if (!dirExists) {
        // Get all directories in tasks folder
        const dirs = fs.readdirSync(tasksDir).filter(item => 
          fs.statSync(path.join(tasksDir, item)).isDirectory() && 
          item !== '__tests__' && 
          item !== 'node_modules'
        );
        
        // Try to match by task type
        foundDir = dirs.find(dir => {
          try {
            // This is a heuristic - look for the TypeID in files
            const files = fs.readdirSync(path.join(tasksDir, dir))
              .filter(file => file.endsWith('.js'));
              
            for (const file of files) {
              const content = fs.readFileSync(path.join(tasksDir, dir, file), 'utf8');
              if (content.includes(`typeID = ${module.typeID}`)) {
                return true;
              }
            }
          } catch (e) {}
          return false;
        });
        
        if (foundDir) {
          foundDir = path.join(tasksDir, foundDir);
        }
      }
      
      expect(foundDir).toBeTruthy();
      
      if (foundDir) {
        // Check for __tests__ directory
        const testsDir = path.join(foundDir, '__tests__');
        const testsDirExists = fs.existsSync(testsDir);
        
        expect(testsDirExists).toBe(true);
        
        // Check for test files
        if (testsDirExists) {
          const testFiles = fs.readdirSync(testsDir).filter(file => 
            file.endsWith('.test.js') || file.endsWith('.spec.js')
          );
          
          expect(testFiles.length).toBeGreaterThan(0);
          
          // Check test content
          if (testFiles.length > 0) {
            const testContent = fs.readFileSync(path.join(testsDir, testFiles[0]), 'utf8');
            const hasTests = /test\s*\(|it\s*\(|describe\s*\(/.test(testContent);
            
            expect(hasTests).toBe(true);
          }
        }
      }
    });
  });
});