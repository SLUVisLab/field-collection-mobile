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

import GeoPointTask from './geopoint/GeoPointTask';
import GeoPointSetup from './geopoint/GeoPointSetup';
import GeoPointAction from './geopoint/GeoPointAction';

import MultiPhotoTask from './multiphoto/MultiPhotoTask';
import MultiPhotoSetup from './multiphoto/MultiPhotoSetup';
import MultiPhotoAction from './multiphoto/MultiPhotoAction';

import BarcodeTask from './barcode/BarcodeTask'
import BarcodeSetup from './barcode/BarcodeSetup';
import BarcodeAction from './barcode/BarcodeAction';

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
  [VideoTask.typeID]: {
    taskAction: VideoAction,
    taskSetup: VideoSetup,
    taskModule: VideoTask
  },
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
  [BarcodeTask.typeID]: {
    taskAction: BarcodeAction,
    taskSetup: BarcodeSetup,
    taskModule: BarcodeTask
  },
  // [GeoPointTask.typeID]: {
  //   taskAction: GeoPointAction,
  //   taskSetup: GeoPointSetup,
  //   taskModule: GeoPointTask
  // },


}
  
export default TaskManifest;