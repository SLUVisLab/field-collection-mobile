import {
  ColorConversionCodes,
  BorderTypes,
  ContourApproximationModes,
  DataTypes,
  OpenCV,
  RetrievalModes,
} from 'react-native-fast-opencv';
import { decodeRgbFile } from './openCvImageAdapter.js';

const imageMatFor = async (asset) => {
  const { width, height, pixels } = await decodeRgbFile(asset);
  return OpenCV.Mat.createFromBuffer('uint8', height, width, 3, pixels);
};
const maskMatFor = async (asset) => {
  const { width, height, pixels } = await decodeRgbFile(asset);
  const binary = new Uint8Array(width * height);
  for (let index = 0; index < binary.length; index += 1) binary[index] = pixels[index * 3];
  return OpenCV.Mat.createFromBuffer('uint8', height, width, 1, binary);
};
const releaseAll = (objects) => objects.forEach((object) => object?.release());

export const createOpenCvMeasurementAdapter = () => ({
  async maskMeasurements(mask) {
    const binary = await maskMatFor(mask);
    const contours = OpenCV.MatVector.create();
    const labels = OpenCV.Mat.create(0, 0, DataTypes.CV_32SC1);
    const stats = OpenCV.Mat.create(0, 0, DataTypes.CV_32SC1);
    const centroids = OpenCV.Mat.create(0, 0, DataTypes.CV_64FC1);
    try {
      const area = OpenCV.countNonZero(binary).value;
      if (area === 0) throw new Error('Mask contains no foreground pixels.');
      OpenCV.findContours(binary, contours, RetrievalModes.RETR_LIST, ContourApproximationModes.CHAIN_APPROX_SIMPLE);
      let perimeter = 0;
      for (let index = 0; index < contours.length; index += 1) {
        const contour = contours.get(index);
        perimeter += OpenCV.arcLength(contour, true).value;
        contour.release();
      }
      const rectangle = OpenCV.boundingRect(binary);
      OpenCV.connectedComponentsWithStats(binary, labels, stats, centroids);
      const statsBuffer = stats.toBuffer('int32').buffer;
      const centroidBuffer = centroids.toBuffer('float64').buffer;
      let component = 1;
      for (let index = 2; index < stats.rows; index += 1) {
        if (statsBuffer[index * 5 + 4] > statsBuffer[component * 5 + 4]) component = index;
      }
      return {
        area: { value: area, unit: 'px2' },
        perimeter: { value: perimeter, unit: 'px', boundary: 'all-contours' },
        boundingBox: { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height, unit: 'px' },
        centroid: {
          x: centroidBuffer[component * 2],
          y: centroidBuffer[component * 2 + 1],
          unit: 'px',
          semantics: 'largest-connected-foreground-component',
        },
      };
    } finally {
      releaseAll([binary, contours, labels, stats, centroids]);
    }
  },
  async imageMeasurements(image, mask) {
    const [source, binary] = await Promise.all([imageMatFor(image), maskMatFor(mask)]);
    const mean = OpenCV.Mat.create(0, 0, DataTypes.CV_64FC1);
    const stddev = OpenCV.Mat.create(0, 0, DataTypes.CV_64FC1);
    const gray = OpenCV.Mat.create(0, 0, DataTypes.CV_8UC1);
    const laplacian = OpenCV.Mat.create(0, 0, DataTypes.CV_64FC1);
    try {
      OpenCV.meanStdDev(source, mean, stddev, binary);
      const channels = mean.toBuffer('float64').buffer;
      OpenCV.cvtColor(source, gray, ColorConversionCodes.COLOR_RGB2GRAY);
      OpenCV.Laplacian(gray, laplacian, DataTypes.CV_64F, 1, 1, 0, BorderTypes.BORDER_DEFAULT);
      OpenCV.meanStdDev(laplacian, mean, stddev, binary);
      const laplacianStdDev = stddev.toBuffer('float64').buffer[0];
      return {
        color: {
          colorSpace: 'sRGB',
          statistic: 'mean',
          channels: { red: channels[0], green: channels[1], blue: channels[2] },
        },
        sharpness: { metric: 'variance-of-laplacian', score: laplacianStdDev ** 2 },
      };
    } finally {
      releaseAll([source, binary, mean, stddev, gray, laplacian]);
    }
  },
});
