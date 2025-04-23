import PhotoTask from './photo/PhotoTask'
import PhotoSetup from './photo/PhotoSetup';
import PhotoAction from './photo/PhotoAction';

import TextTask from './text/TextTask'
import TextSetup from './text/TextSetup';
import TextAction from './text/TextAction';

import NumberTask from './number/NumberTask';
import NumberSetup from './number/NumberSetup';
import NumberAction from './number/NumberAction';

import ChoiceTask from './choice/ChoiceTask';
import ChoiceSetup from './choice/ChoiceSetup';
import ChoiceAction from './choice/ChoiceAction';

import VideoTask from './video/VideoTask';
import VideoSetup from './video/VideoSetup';
import VideoAction from './video/VideoAction';

import LocationTask from './location/LocationTask';
import LocationSetup from './location/LocationSetup';
import LocationAction from './location/LocationAction';

import MultiPhotoTask from './multiphoto/MultiPhotoTask';
import MultiPhotoSetup from './multiphoto/MultiPhotoSetup';
import MultiPhotoAction from './multiphoto/MultiPhotoAction';

const TaskManifest = {
  [PhotoTask.typeID]: {
    taskAction: PhotoAction,
    taskSetup: PhotoSetup,
    taskModule: PhotoTask
  },
  [MultiPhotoTask.typeID]: {
    taskAction: MultiPhotoAction,
    taskSetup: MultiPhotoSetup,
    taskModule: MultiPhotoTask
  },
  // [VideoTask.typeID]: {
  //   taskAction: VideoAction,
  //   taskSetup: VideoSetup,
  //   taskModule: VideoTask
  // },
  [TextTask.typeID]: {
    taskAction: TextAction,
    taskSetup: TextSetup,
    taskModule: TextTask
  },
  [NumberTask.typeID]: {
    taskAction: NumberAction,
    taskSetup: NumberSetup,
    taskModule: NumberTask
  },
  [ChoiceTask.typeID]: {
    taskAction: ChoiceAction,
    taskSetup: ChoiceSetup,
    taskModule: ChoiceTask
  },
  // [LocationTask.typeID]: {
  //   taskAction: LocationAction,
  //   taskSetup: LocationSetup,
  //   taskModule: LocationTask
  // },


}
  
export default TaskManifest;