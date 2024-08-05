import PhotoTask from './photo/PhotoTask'
import PhotoSetup from './photo/PhotoSetup';
import PhotoAction from './photo/PhotoAction';

import TextTask from './text/TextTask'
import TextSetup from './text/TextSetup';
import TextAction from './text/TextAction';

import NumberTask from './number/NumberTask';
import NumberSetup from './number/NumberSetup';
import NumberAction from './number/NumberAction';

const TaskManifest = {
  [TextTask.typeID]: {
    taskAction: TextAction,
    taskSetup: TextSetup,
    taskModule: TextTask
  },
  [PhotoTask.typeID]: {
    taskAction: PhotoAction,
    taskSetup: PhotoSetup,
    taskModule: PhotoTask
  },
  [NumberTask.typeID]: {
    taskAction: NumberAction,
    taskSetup: NumberSetup,
    taskModule: NumberTask
  },

}
  
export default TaskManifest;