// Import react-native-fast-opencv
import OpenCV from 'react-native-fast-opencv';
import { 
  ColorConversionCodes, 
  ThresholdTypes, 
  MorphTypes, 
  DistanceTypes,
  ConnectedComponentsTypes 
} from 'react-native-fast-opencv';
import { UnionFind, persistence } from './UnionFind';


// NOTE: This function needs to be completely rewritten for React Native
// using React Native image handling instead of sharp
async function resizeImage(inputPath) {
    // TODO: Replace with React Native image resizing and OpenCV.base64ToMat
  // Example approach:
  // 1. Use react-native-image-manipulator or expo-image-manipulator to resize
  // 2. Convert to base64
  // 3. Use OpenCV.base64ToMat to convert to Mat
  // const { width, height } = await sharp(inputPath).metadata();
  // let newWidth, newHeight;
  // if (width > height) {
  //   newWidth = 1024;
  //   newHeight = Math.round(height * (1024 / width));
  // } else {
  //   newHeight = 1024;
  //   newWidth = Math.round(width * (1024 / height));
  // }
  // const buffer = await sharp(inputPath).resize(newWidth, newHeight).toBuffer();
  // return cv.imdecode(buffer);
}

function getLargestComponent(binaryImg, minFraction = 0.1, minSize = null) {
  // Create output matrices
  const labels = OpenCV.createMat(binaryImg.rows, binaryImg.cols, OpenCV.TYPE.CV_32S);
  const stats = OpenCV.createMat(255, 5, OpenCV.TYPE.CV_32S); // Assuming max 255 components
  const centroids = OpenCV.createMat(255, 2, OpenCV.TYPE.CV_64F);
  
  // Call connected components
  const { value: numLabels } = OpenCV.invoke('connectedComponentsWithStats', 
    binaryImg, labels, stats, centroids);
  
  // Count non-zero pixels
  const { value: totalPixels } = OpenCV.invoke('countNonZero', binaryImg);

  const sizes = [];
  for (let i = 1; i < numLabels; i++) {
    sizes.push({
      label: i,
      size: stats.get(i, ConnectedComponentsTypes.CC_STAT_AREA)
    });
  }

  if (minSize === null) {
    minSize = Math.max(...sizes.map(x => x.size)) + 1;
  }

  const validLabels = sizes
    .filter(x => x.size / totalPixels > minFraction || x.size > minSize)
    .map(x => x.label);

  const mask = OpenCV.createMat(binaryImg.rows, binaryImg.cols, OpenCV.TYPE.CV_8UC1, 0);
  
  // NOTE: Need to verify how to implement equal and setTo in react-native-fast-opencv
  // This might need a custom implementation
  for (let label of validLabels) {
    // TODO: Replace with appropriate implementation
    // const region = OpenCV.invoke('equal', labels, label); 
    // OpenCV.invoke('setTo', mask, 255, region);
    // const region = labels.equal(label);
    // mask.setTo(255, region);
  }

  return mask;
}

// // STill need to convert this function
// async function countPetals(imagePath, pad = 20) {
//   const image = await resizeImage(imagePath);
//   const rgb = image.medianBlur(5);

//   const hsv = rgb.cvtColor(cv.COLOR_BGR2HSV);
//   const hsvMask = hsv.inRange(new cv.Vec3(15, 40, 40), new cv.Vec3(45, 255, 255));

//   const lab = rgb.cvtColor(cv.COLOR_BGR2Lab);
//   const b = lab.split()[2];
//   const bBlur = b.gaussianBlur(new cv.Size(5, 5), 0);
//   const { threshold } = bBlur.threshold(0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
//   const bMask = bBlur.threshold(threshold, 255, cv.THRESH_BINARY);

//   const yellowMask = hsvMask.bitwiseAnd(bMask);

//   const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
//   const opened = yellowMask.morphologyEx(kernel, cv.MORPH_OPEN);
//   const closed = opened.morphologyEx(kernel, cv.MORPH_CLOSE);

//   const largest = getLargestComponent(closed);
//   const filled = largest.dilate(new cv.Mat(), new cv.Point(-1, -1), 1); // approximation

//   const nonZero = filled.findNonZero();
//   const xVals = nonZero.map(p => p.x);
//   const yVals = nonZero.map(p => p.y);
//   const xMin = Math.max(0, Math.min(...xVals) - pad);
//   const xMax = Math.min(filled.cols, Math.max(...xVals) + pad);
//   const yMin = Math.max(0, Math.min(...yVals) - pad);
//   const yMax = Math.min(filled.rows, Math.max(...yVals) + pad);
//   const cropped = filled.getRegion(new cv.Rect(xMin, yMin, xMax - xMin, yMax - yMin));

//   // Distance transform
//   const center = cropped.moments();
//   const centerX = Math.round(center.m10 / center.m00);
//   const centerY = Math.round(center.m01 / center.m00);

//   const edtInput = new cv.Mat(cropped.rows, cropped.cols, cv.CV_8UC1, 1);
//   edtInput.set(centerY, centerX, 0);
//   const edt = edtInput.distanceTransform(cv.DIST_L2, 5);
//   for (let y = 0; y < edt.rows; y++) {
//     for (let x = 0; x < edt.cols; x++) {
//       if (cropped.at(y, x) === 0) {
//         edt.set(y, x, 0);
//       }
//     }
//   }

//   const maxRadius = edt.minMaxLoc().maxVal;

//   // Convert to JS array for persistence
//   const edtArray = [];
//   for (let y = 0; y < edt.rows; y++) {
//     edtArray.push([]);
//     for (let x = 0; x < edt.cols; x++) {
//       edtArray[y].push(edt.at(y, x));
//     }
//   }

//   const pers = persistence(edtArray).sort((a, b) => b[0] - a[0]);
//   const thresholdDist = maxRadius * 0.03;

//   let k = 1;
//   while (k < pers.length && pers[k][0] > thresholdDist) k++;

//   const numPetals = k;
//   return numPetals;
// }

async function countPetals(imagePath, pad = 20) {
  try {
    const image = await resizeImage(imagePath);
    
    // Apply median blur
    const rgb = OpenCV.createMat(image.rows, image.cols, image.type);
    OpenCV.invoke('medianBlur', image, rgb, 5);
    
    // Convert to HSV
    const hsv = OpenCV.createMat(rgb.rows, rgb.cols, rgb.type);
    OpenCV.invoke('cvtColor', rgb, hsv, ColorConversionCodes.COLOR_BGR2HSV);
    
    // Create HSV mask for yellow color range
    const hsvMask = OpenCV.createMat(hsv.rows, hsv.cols, OpenCV.TYPE.CV_8UC1);
    OpenCV.invoke('inRange', hsv, [15, 40, 40], [45, 255, 255], hsvMask);
    
    // Convert to Lab
    const lab = OpenCV.createMat(rgb.rows, rgb.cols, rgb.type);
    OpenCV.invoke('cvtColor', rgb, lab, ColorConversionCodes.COLOR_BGR2Lab);
    
    // Split channels - NOTE: Need to verify this works as expected
    const channels = [];
    OpenCV.invoke('split', lab, channels);
    const b = channels[2];
    
    // Apply Gaussian blur
    const bBlur = OpenCV.createMat(b.rows, b.cols, b.type);
    OpenCV.invoke('GaussianBlur', b, bBlur, [5, 5], 0);
    
    // Apply Otsu threshold to find optimal threshold value
    const bTemp = OpenCV.createMat(bBlur.rows, bBlur.cols, OpenCV.TYPE.CV_8UC1);
    const { value: threshold } = OpenCV.invoke('threshold', bBlur, bTemp, 0, 255, 
      ThresholdTypes.THRESH_BINARY + ThresholdTypes.THRESH_OTSU);
    
    // Apply threshold with the calculated value
    const bMask = OpenCV.createMat(bBlur.rows, bBlur.cols, OpenCV.TYPE.CV_8UC1);
    OpenCV.invoke('threshold', bBlur, bMask, threshold, 255, ThresholdTypes.THRESH_BINARY);
    
    // Bitwise AND of masks
    const yellowMask = OpenCV.createMat(hsvMask.rows, hsvMask.cols, OpenCV.TYPE.CV_8UC1);
    OpenCV.invoke('bitwise_and', hsvMask, bMask, yellowMask);
    
    // Create structuring element for morphology
    const kernel = OpenCV.createMat();
    OpenCV.invoke('getStructuringElement', MorphTypes.MORPH_ELLIPSE, [5, 5], kernel);
    
    // Open then close
    const opened = OpenCV.createMat(yellowMask.rows, yellowMask.cols, yellowMask.type);
    OpenCV.invoke('morphologyEx', yellowMask, opened, MorphTypes.MORPH_OPEN, kernel);
    
    const closed = OpenCV.createMat(opened.rows, opened.cols, opened.type);
    OpenCV.invoke('morphologyEx', opened, closed, MorphTypes.MORPH_CLOSE, kernel);
    
    // Find largest component
    const largest = getLargestComponent(closed);
    
    // Dilate
    const filled = OpenCV.createMat(largest.rows, largest.cols, largest.type);
    const emptyMat = OpenCV.createMat();
    OpenCV.invoke('dilate', largest, filled, emptyMat, [-1, -1], 1);
    
    // Find non-zero pixels - NOTE: Need to verify return format
    const nonZero = OpenCV.invoke('findNonZero', filled);
    
    // We need to extract x and y from the returned points
    // NOTE: Format of nonZero might be different from opencv4nodejs
    const xVals = nonZero.map(p => p.x);
    const yVals = nonZero.map(p => p.y);
    
    const xMin = Math.max(0, Math.min(...xVals) - pad);
    const xMax = Math.min(filled.cols, Math.max(...xVals) + pad);
    const yMin = Math.max(0, Math.min(...yVals) - pad);
    const yMax = Math.min(filled.rows, Math.max(...yVals) + pad);
    
    // Crop the image
    const cropped = OpenCV.createMat();
    OpenCV.invoke('crop', filled, cropped, [xMin, yMin, xMax - xMin, yMax - yMin]);
    
    // Calculate moments - NOTE: Need to verify/implement
    // const center = OpenCV.invoke('moments', cropped);
    // Temporary alternative based on nonZero points - needs proper implementation
    const centerX = Math.round(xVals.reduce((a, b) => a + b, 0) / xVals.length);
    const centerY = Math.round(yVals.reduce((a, b) => a + b, 0) / yVals.length);
    
    // Create matrix for distance transform input
    const edtInput = OpenCV.createMat(cropped.rows, cropped.cols, OpenCV.TYPE.CV_8UC1, 1);
    
    // NOTE: Need to verify how to set a specific pixel value
    // edtInput.set(centerY, centerX, 0);
    
    // Distance transform
    const edt = OpenCV.createMat(cropped.rows, cropped.cols, OpenCV.TYPE.CV_32F);
    OpenCV.invoke('distanceTransform', edtInput, edt, DistanceTypes.DIST_L2, 5);
    
    // NOTE: Need pixel-level access implementation
    // for (let y = 0; y < edt.rows; y++) {
    //   for (let x = 0; x < edt.cols; x++) {
    //     if (cropped.at(y, x) === 0) {
    //       edt.set(y, x, 0);
    //     }
    //   }
    // }
    
    // Find max value
    const { maxVal: maxRadius } = OpenCV.invoke('minMaxLoc', edt);
    
    // NOTE: Need to verify how to extract matrix data to JS array
    // Convert to JS array for persistence
    const edtArray = [];
    // for (let y = 0; y < edt.rows; y++) {
    //   edtArray.push([]);
    //   for (let x = 0; x < edt.cols; x++) {
    //     edtArray[y].push(edt.at(y, x));
    //   }
    // }
    
    // Clean up memory
    OpenCV.clearBuffers();
    
    // NOTE: This part can't be implemented yet without matrix data extraction
    // const pers = persistence(edtArray).sort((a, b) => b[0] - a[0]);
    // const thresholdDist = maxRadius * 0.03;
    // 
    // let k = 1;
    // while (k < pers.length && pers[k][0] > thresholdDist) k++;
    // 
    // const numPetals = k;
    // return numPetals;
    
    // For now, return a placeholder
    return 0;
  } catch (error) {
    console.error('Error in countPetals:', error);
    OpenCV.clearBuffers(); // Make sure to clean up even on error
    throw error;
  }
}

export {
  countPetals
};
