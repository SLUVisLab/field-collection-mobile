import Task from '../Task';
import Ionicons from '@expo/vector-icons/Ionicons';

const BarcodeTaskIcon = ({ style, size = 24 }) => <Ionicons name="qr-code-outline" size={size} color="black" style={style} />;

class BarcodeTask extends Task {
  constructor(taskID, taskDisplayName, dataLabel, instructions, options) {
    super(taskID, taskDisplayName, dataLabel, instructions, options);
  }


}

BarcodeTask.typeID = 8;
BarcodeTask.typeDisplayName = 'Barcode';
BarcodeTask.typeDescription = "Scan a barcode or a QR code with the camera"
BarcodeTask.typeIcon = BarcodeTaskIcon;
BarcodeTask.setupViewPath = '#';
BarcodeTask.actionViewPath = '#';

export default BarcodeTask;