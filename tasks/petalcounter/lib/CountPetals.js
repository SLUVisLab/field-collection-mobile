// Import react-native-fast-opencv
import OpenCV from 'react-native-fast-opencv';
import OpenCV, {
  ObjectType,
  DataTypes,
  CmpTypes,
  ColorConversionCodes,
  ThresholdTypes,
  MorphTypes,
  DistanceTypes,
  ConnectedComponentsTypes
} from 'react-native-fast-opencv';
import * as ImageManipulator from 'expo-image-manipulator';
import { UnionFind, persistence } from './UnionFind';



export async function resizeImage(inputUri) {
  try {
    // Use the object-oriented image manipulation context
    const context = ImageManipulator.manipulate(inputUri);

    // Load metadata and get dimensions
    const metadata = await context.renderAsync();
    const { width: origWidth, height: origHeight } = metadata;

    // Resize with max 1024px on longest side
    let newWidth, newHeight;
    if (origWidth > origHeight) {
      newWidth = 1024;
      newHeight = Math.round((origHeight * 1024) / origWidth);
    } else {
      newHeight = 1024;
      newWidth = Math.round((origWidth * 1024) / origHeight);
    }

    // Queue resize operation
    context.resize({ width: newWidth, height: newHeight });

    // Render resized image
    const resized = await context.renderAsync();

    // Save to base64 for OpenCV
    const result = await resized.saveAsync({
      format: ImageManipulator.SaveFormat.PNG,
      compress: 1.0,
      base64: true
    });

    // Convert base64 to Mat
    const mat = OpenCV.base64ToMat(result.base64);
    return mat;
  } catch (err) {
    console.error('Error resizing image for OpenCV:', err);
    throw err;
  }
}

export function fillHoles(binaryMask) {
  // Create a destination image to draw into (same size/type as binaryMask)
  const filled = OpenCV.createObject(
    ObjectType.Mat,
    binaryMask.rows,
    binaryMask.cols,
    binaryMask.type
  );

  // Create empty contour container
  const contours = OpenCV.createObject(ObjectType.MatVector); // each contour is a PointVector
  const hierarchy = OpenCV.createObject(ObjectType.Mat);

  // Find contours
  OpenCV.invoke(
    'findContours',
    binaryMask,
    contours,
    1,  // RETR_CCOMP — retrieves all and organizes in 2-level hierarchy
    2   // CHAIN_APPROX_SIMPLE
  );

  // Draw contours filled (thickness = -1)
  OpenCV.invoke(
    'drawContours',
    filled,     // destination
    contours,   // all contours
    -1,         // draw all
    OpenCV.createObject(ObjectType.Scalar, 255), // fill color
    -1,         // filled interior
    8           // LINE_8
  );

  return filled;
}

function getLargestComponent(binaryImg, minFraction = 0.1, minSize = null) {
  const { rows, cols } = binaryImg;
  const labels = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_32S);
  const stats = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_32S);
  const centroids = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_64F);

  const { value: numLabels } = OpenCV.invoke(
    'connectedComponentsWithStats',
    binaryImg, labels, stats, centroids
  );

  const { value: totalPixels } = OpenCV.invoke('countNonZero', binaryImg);

  const sizes = [];
  for (let i = 1; i < numLabels; i++) {
    const area = OpenCV.invoke('Mat.at', stats, i, OpenCV.ConnectedComponentsTypes.CC_STAT_AREA).value;
    sizes.push({ label: i, size: area });
  }
  if (minSize === null && sizes.length) {
    minSize = Math.max(...sizes.map(x => x.size)) + 1;
  }

  const valid = sizes
    .filter(x => x.size / totalPixels > minFraction || x.size > minSize)
    .map(x => x.label);

  const mask = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
  OpenCV.invoke('setTo', mask, OpenCV.createObject(ObjectType.Scalar, 0)); // initial zero fill

  valid.forEach(label => {
    const region = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
    OpenCV.invoke('compare', labels, label, region, CmpTypes.CMP_EQ);
    OpenCV.invoke('copyTo', mask, region, OpenCV.createObject(ObjectType.Scalar, 255));
    OpenCV.clearBuffers(); // clear region
  });

  OpenCV.clearBuffers(); // clear other temporaries
  return mask;
}


async function countPetals(imagePath, pad = 20) {
  try {
    const image = await resizeImage(imagePath);
    
    // Create a copy of the original resized image to return
    const imageToReturn = OpenCV.createObject(ObjectType.Mat);
    OpenCV.invoke('copy', image, imageToReturn);

    const rgb = OpenCV.createObject(ObjectType.Mat, image.rows, image.cols, image.type);
    OpenCV.invoke('medianBlur', image, rgb, 5);

    const hsv = OpenCV.createObject(ObjectType.Mat, rgb.rows, rgb.cols, rgb.type);
    OpenCV.invoke('cvtColor', rgb, hsv, ColorConversionCodes.COLOR_BGR2HSV);

    const hsvMask = OpenCV.createObject(ObjectType.Mat, hsv.rows, hsv.cols, DataTypes.CV_8U);
    OpenCV.invoke('inRange', hsv, [15, 40, 40], [45, 255, 255], hsvMask);

    const lab = OpenCV.createObject(ObjectType.Mat, rgb.rows, rgb.cols, rgb.type);
    OpenCV.invoke('cvtColor', rgb, lab, ColorConversionCodes.COLOR_BGR2Lab);

    // NOTE: No verified way to split channels directly in JS – check return value
    const channels = [];
    OpenCV.invoke('split', lab, channels);  // expect channels[2] to be 'b'
    const b = channels[2];

    const bBlur = OpenCV.createObject(ObjectType.Mat, b.rows, b.cols, b.type);
    OpenCV.invoke('GaussianBlur', b, bBlur, [5, 5], 0);

    const bTemp = OpenCV.createObject(ObjectType.Mat, bBlur.rows, bBlur.cols, DataTypes.CV_8U);
    const { value: threshold } = OpenCV.invoke('threshold', bBlur, bTemp, 0, 255, ThresholdTypes.THRESH_BINARY + ThresholdTypes.THRESH_OTSU);

    const bMask = OpenCV.createObject(ObjectType.Mat, bBlur.rows, bBlur.cols, DataTypes.CV_8U);
    OpenCV.invoke('threshold', bBlur, bMask, threshold, 255, ThresholdTypes.THRESH_BINARY);

    const yellowMask = OpenCV.createObject(ObjectType.Mat, hsvMask.rows, hsvMask.cols, DataTypes.CV_8U);
    OpenCV.invoke('bitwise_and', hsvMask, bMask, yellowMask);

    const kernel = OpenCV.invoke('getStructuringElement', MorphTypes.MORPH_ELLIPSE, [5, 5]);

    const opened = OpenCV.createObject(ObjectType.Mat, yellowMask.rows, yellowMask.cols, yellowMask.type);
    OpenCV.invoke('morphologyEx', yellowMask, opened, MorphTypes.MORPH_OPEN, kernel);

    const closed = OpenCV.createObject(ObjectType.Mat, opened.rows, opened.cols, opened.type);
    OpenCV.invoke('morphologyEx', opened, closed, MorphTypes.MORPH_CLOSE, kernel);

    const largest = getLargestComponent(closed);

    const filled = fillHoles(largest);

    const { value: nonZero } = OpenCV.invoke('findNonZero', filled);

    // NOTE: need to validate format of `nonZero` – assumed array of {x, y}
    const xVals = nonZero.map(p => p.x);
    const yVals = nonZero.map(p => p.y);

    const xMin = Math.max(0, Math.min(...xVals) - pad);
    const xMax = Math.min(filled.cols, Math.max(...xVals) + pad);
    const yMin = Math.max(0, Math.min(...yVals) - pad);
    const yMax = Math.min(filled.rows, Math.max(...yVals) + pad);

    const cropped = OpenCV.createObject(ObjectType.Mat);
    OpenCV.invoke('crop', filled, cropped, [xMin, yMin, xMax - xMin, yMax - yMin]);

    // Estimate center from non-zero points
    const centerX = Math.round(xVals.reduce((a, b) => a + b, 0) / xVals.length);
    const centerY = Math.round(yVals.reduce((a, b) => a + b, 0) / yVals.length);

    const edtInput = OpenCV.createObject(ObjectType.Mat, cropped.rows, cropped.cols, DataTypes.CV_8U);

    // Workaround: no direct Mat.set: draw a tiny zero-mask circle at center
    OpenCV.invoke(
      'circle',
      edtInput,
      [centerX, centerY],
      1,
      OpenCV.createObject(ObjectType.Scalar, 0),
      -1
    );

    const edt = OpenCV.createObject(ObjectType.Mat, cropped.rows, cropped.cols, DataTypes.CV_32F);
    OpenCV.invoke('distanceTransform', edtInput, edt, DistanceTypes.DIST_L2, 5);

    const { value: maxRadius } = OpenCV.invoke('minMaxLoc', edt);

    const edtBuf = OpenCV.matToBuffer(edt, 'float32');
    const { rows, cols, buffer } = edtBuf;
    const floatArr = new Float32Array(buffer);
    const edtArray = [];

    // Convert flat float array to 2D array
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        row.push(floatArr[y * cols + x]);
      }
      edtArray.push(row);
    }

    OpenCV.clearBuffers();

    // Compute persistence features
    const pers = persistence(edtArray);
    pers.sort((a, b) => b[0] - a[0]);

    const thresholdDist = maxRadius * 0.03;
    let k = 1;
    while (k < pers.length && pers[k][0] > thresholdDist) k++;

    
  // Slice out births and deaths
  const births = pers.slice(0, k).map(p => p[2]); // (x, y) of each elder
  const deaths = pers.slice(1, k).map(p => p[1]); // (x, y) of each saddle

  // Also return crop info for aligning results
  const maskBounds = {
    xMin,
    xMax,
    yMin,
    yMax,
  };

  // Convert the Mat to a base64 string for easy display
  const base64Image = OpenCV.matToBase64(imageToReturn);
  
  // Release the copied image
  imageToReturn.release();

  return {
    count: k,
    maxRadius,
    thresholdDist,
    births,
    deaths,
    edtArray,
    maskBounds,
    image: base64Image, // Add the resized image to the result
    dimensions: {
      width: image.cols,
      height: image.rows
    }
  };

  } catch (err) {
    OpenCV.clearBuffers();
    console.error('Error in countPetals:', err);
    throw err;
  }
}


export {
  countPetals
};
