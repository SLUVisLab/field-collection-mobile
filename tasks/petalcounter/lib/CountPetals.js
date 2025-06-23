import {
  OpenCV,
  ObjectType,
  DataTypes,
  CmpTypes,
  ColorConversionCodes,
  ThresholdTypes,
  MorphTypes,
  MorphShapes,
  DistanceTypes,
  ConnectedComponentsTypes,
  LineTypes,
} from 'react-native-fast-opencv';
import * as ImageManipulator from 'expo-image-manipulator';
import { UnionFind, persistence } from './UnionFind';

console.log('CountPetals module loaded');

function getMatInfo(mat) {
  const info = OpenCV.toJSValue(mat, 'png');
  return {
    rows: info.rows,
    cols: info.cols,
    type: info.type
  };
}

export async function resizeImage(inputUri) {
  console.log('Starting resizeImage with uri:', inputUri?.substring(0, 20) + '...');
  try {
    console.log('Getting image metadata...');
    // First, get metadata (dimensions) without any actions
    const meta = await ImageManipulator.manipulateAsync(inputUri, [], {
      base64: false,
    });
    console.log('Image metadata received:', meta?.width, 'x', meta?.height);

    const { width: origWidth, height: origHeight } = meta;

    // Calculate size capped at 512px
    let newWidth, newHeight;
    if (origWidth > origHeight) {
      newWidth = 512;
      newHeight = Math.round((origHeight * 512) / origWidth);
    } else {
      newHeight = 512;
      newWidth = Math.round((origWidth * 512) / origHeight);
    }
    console.log('New dimensions:', newWidth, 'x', newHeight);

    // Resize, compress, and get base64
    console.log('Resizing image...');
    const result = await ImageManipulator.manipulateAsync(
      inputUri,
      [{ resize: { width: newWidth, height: newHeight } }],
      { compress: 1.0, format: ImageManipulator.SaveFormat.PNG, base64: true }
    );
    console.log('Image resized, base64 length:', result?.base64?.length);

    // Convert base64 image to OpenCV Mat
    console.log('Converting to OpenCV Mat...');
    if (!OpenCV) {
      console.error('OpenCV is undefined!');
      throw new Error('OpenCV module is undefined');
    }
    
    if (!result.base64) {
      console.error('No base64 data in result!');
      throw new Error('No base64 data available');
    }
    
    try {
      let base64Data = result.base64;
      if (base64Data.startsWith('data:')) {
        base64Data = base64Data.split(',')[1];
        console.log('Removed data URI prefix from base64');
      }
      
      console.log('Base64 first 20 chars:', base64Data.substring(0, 20));
      const mat = OpenCV.base64ToMat(base64Data);
      
      const matInfo = getMatInfo(mat);
      console.log('Conversion complete, Mat dimensions:', matInfo.rows, 'x', matInfo.cols);
      return mat;
    } catch (err) {
      console.error('base64ToMat failed:', err);
      throw new Error(`base64ToMat failed: ${err.message}`);
    }
  } catch (err) {
    console.error('Error resizing image for OpenCV:', err);
    throw err;
  }
}

export function fillHoles(binaryMask) {
  console.log('Starting fillHoles...');
  try {
    // Get dimensions using helper function
    const maskInfo = getMatInfo(binaryMask);
    
    // Create a destination image to draw into
    console.log('Creating filled matrix...');
    const filled = OpenCV.createObject(
      ObjectType.Mat,
      maskInfo.rows,
      maskInfo.cols,
      maskInfo.type
    );
    console.log('Creating contour containers...');

    // Create empty contour container
    const contours = OpenCV.createObject(ObjectType.MatVector, 0); // vector of size 0
    const hierarchy = OpenCV.createObject(ObjectType.Mat, maskInfo.rows, maskInfo.cols, DataTypes.CV_32S);

    // Find contours
    console.log('Finding contours...');
    OpenCV.invoke(
      'findContours',
      binaryMask,
      contours,
      1,  // RETR_CCOMP
      2   // CHAIN_APPROX_SIMPLE
    );

    const { array } = OpenCV.toJSValue(contours);
    console.log('Found contours, count:', array.length);

    // Draw contours filled (thickness = -1)
    console.log('Drawing filled contours...');
    OpenCV.invoke(
      'drawContours',
      filled,
      contours,
      -1,
      OpenCV.createObject(ObjectType.Scalar, 255),
      -1,
      8
    );
    console.log('Contours drawn');

    return filled;
  } catch (err) {
    console.error('Error in fillHoles:', err);
    throw err;
  }
}

// 
// function getLargestComponent(binaryImg, minFraction = 0.1, minSize = null) {
//   console.log(' Starting getLargestComponent...');
//   try {
//     const imgInfo = getMatInfo(binaryImg);
//     const rows = imgInfo.rows;
//     const cols = imgInfo.cols;

//     console.log('Input size:', rows, 'x', cols);

//     console.log('Creating labels matrix...');
//     const labels = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_32S);
//     const stats = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_32S);
//     const centroids = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_64F);

//     console.log('Running connected components...');
//     const { value: numLabels } = OpenCV.invoke(
//       'connectedComponentsWithStats',
//       binaryImg, labels, stats, centroids
//     );
//     console.log('Found', numLabels, 'connected components');

//     console.log('Counting non-zero pixels...');
//     const { value: totalPixels } = OpenCV.invoke('countNonZero', binaryImg);
//     console.log('Total non-zero pixels:', totalPixels);

//     console.log('Analyzing component sizes...');
//     const sizes = [];
//     const statsInfo = OpenCV.toJSValue(stats);
//     const statsBuf = OpenCV.matToBuffer(stats, 'int32');
//     const intArray = new Int32Array(statsBuf.buffer);

//     for (let i = 1; i < numLabels; i++) {
//       try {
//         const area = intArray[i * 5 + ConnectedComponentsTypes.CC_STAT_AREA];
//         sizes.push({ label: i, size: area });
//       } catch (err) {
//         console.error('Error reading stats at index', i, ':', err);
//       }
//     }

//     if (minSize === null && sizes.length) {
//       minSize = Math.max(...sizes.map(x => x.size)) + 1;
//       console.log('Using minSize:', minSize);
//     }

//     console.log('Filtering valid components...');
//     const valid = sizes
//       .filter(x => x.size / totalPixels > minFraction || x.size > minSize)
//       .map(x => x.label);
//     console.log('Valid components:', valid.length, 'of', sizes.length);

//     console.log('Creating result mask...');
//     const mask = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
//     OpenCV.invoke('setTo', mask, OpenCV.createObject(ObjectType.Scalar, 0));

//     console.log('Processing each valid component...');
//     valid.forEach((label, index) => {
//       try {
//         console.log(`Processing component ${index + 1}/${valid.length} (label ${label})...`);
//         const region = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
//         const labelScalar = OpenCV.createObject(ObjectType.Scalar, label);
//         OpenCV.invoke('compare', labels, labelScalar, region, CmpTypes.CMP_EQ);

//         console.log('Copying to result mask...');
//         // Create a matrix filled with white (255)
//         const white = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
//         OpenCV.invoke('threshold', region, white, 0, 255, ThresholdTypes.THRESH_BINARY_INV);

//         // Use bitwise_and to copy only the valid region into the mask
//         OpenCV.invoke('bitwise_or', mask, white, mask, region);

//       } catch (err) {
//         console.error('Error processing component', label, ':', err);
//       }
//     });

//     // console.log('Cleaning up remaining buffers...');
//     // const result = OpenCV.invoke('clone', mask); // Clone before clearing
//     // OpenCV.clearBuffers();
//     console.log('getLargestComponent complete');
//     return mask;;
//   } catch (err) {
//     console.error('Error in getLargestComponent:', err);
//     throw err;
//   }
// }

function getLargestComponent(binaryImg, minFraction = 0.1, minSize = null) {
  console.log('🔍 Starting getLargestComponent...');
  try {
    const { rows, cols, type } = getMatInfo(binaryImg);

    const labels = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_32S);
    const stats = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_32S);
    const centroids = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_64F);

    const { value: numLabels } = OpenCV.invoke(
      'connectedComponentsWithStats',
      binaryImg, labels, stats, centroids
    );

    console.log('Connected components found:', numLabels);

    const { value: totalPixels } = OpenCV.invoke('countNonZero', binaryImg);
    const statsBuf = OpenCV.matToBuffer(stats, 'int32');
    const intArray = new Int32Array(statsBuf.buffer);

    const sizes = [];
    for (let i = 1; i < numLabels; i++) {
      const area = intArray[i * 5 + ConnectedComponentsTypes.CC_STAT_AREA];
      sizes.push({ label: i, size: area });
    }

    if (minSize === null && sizes.length > 0) {
      minSize = Math.max(...sizes.map(x => x.size)) + 1;
    }

    const valid = sizes
      .filter(x => x.size / totalPixels > minFraction || x.size > minSize)
      .map(x => x.label);

    console.log('Valid components:', valid.length);

    const mask = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
    const pt1 = OpenCV.createObject(ObjectType.Point, 0, 0);
    const pt2 = OpenCV.createObject(ObjectType.Point, cols, rows);
    const black = OpenCV.createObject(ObjectType.Scalar, 0);
    OpenCV.invoke('rectangle', mask, pt1, pt2, black, -1, LineTypes.LINE_8);

    valid.forEach((label, index) => {
      const region = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
      const labelScalar = OpenCV.createObject(ObjectType.Scalar, label);
      OpenCV.invoke('compare', labels, labelScalar, region, CmpTypes.CMP_EQ);

      OpenCV.invoke('bitwise_or', mask, region, mask); // add region to mask
    });

    console.log('✅ getLargestComponent complete');
    return mask;
  } catch (err) {
    console.error('❌ Error in getLargestComponent:', err);
    throw err;
  }
}


async function generateColorMask(imagePath, colorParams) {
  console.log('🎯 Generating sharp magenta mask preview...');
  try {
    const image = await resizeImage(imagePath);
    const imageInfo = getMatInfo(image);

    // Blur to smooth edges
    const rgb = OpenCV.createObject(ObjectType.Mat, imageInfo.rows, imageInfo.cols, imageInfo.type);
    OpenCV.invoke('medianBlur', image, rgb, 5);

    // Convert to HSV
    const hsv = OpenCV.createObject(ObjectType.Mat, imageInfo.rows, imageInfo.cols, imageInfo.type);
    OpenCV.invoke('cvtColor', rgb, hsv, ColorConversionCodes.COLOR_BGR2HSV);

    // Create binary mask
    const hsvMask = OpenCV.createObject(ObjectType.Mat, imageInfo.rows, imageInfo.cols, DataTypes.CV_8U);
    const lowerb = OpenCV.createObject(ObjectType.Scalar,
      colorParams.hueMin, colorParams.satMin, colorParams.valMin);
    const upperb = OpenCV.createObject(ObjectType.Scalar,
      colorParams.hueMax, colorParams.satMax, colorParams.valMax);
    OpenCV.invoke('inRange', hsv, lowerb, upperb, hsvMask);

    // Clone blurred image to use as base
    const result = OpenCV.invoke('clone', rgb);

    // Create magenta overlay (filled using rectangle since setTo is unsupported)
    const magentaOverlay = OpenCV.createObject(ObjectType.Mat, imageInfo.rows, imageInfo.cols, imageInfo.type);
    const magentaColor = OpenCV.createObject(ObjectType.Scalar, 255, 0, 255); // BGR: hot magenta

    const pt1 = OpenCV.createObject(ObjectType.Point, 0, 0);
    const pt2 = OpenCV.createObject(ObjectType.Point, imageInfo.cols, imageInfo.rows);
    OpenCV.invoke('rectangle', magentaOverlay, pt1, pt2, magentaColor, -1, LineTypes.LINE_8);

    // Masked copy: copy magentaOverlay into result only where hsvMask is white
    OpenCV.invoke('copyTo', magentaOverlay, result, hsvMask);

    // Convert result and mask to base64 for display
    const previewBase64 = OpenCV.toJSValue(result, 'jpeg').base64;
    const maskBase64 = OpenCV.toJSValue(hsvMask, 'jpeg').base64;

    OpenCV.clearBuffers();

    return {
      preview: previewBase64,
      mask: maskBase64,
      dimensions: {
        width: imageInfo.cols,
        height: imageInfo.rows
      }
    };
  } catch (err) {
    console.error('💥 Error in generateColorMask:', err);
    OpenCV.clearBuffers();
    throw err;
  }
}

// Modify countPetals to accept color parameters
async function countPetals(imagePath, pad = 20, colorParams = null) {
  console.log('Starting countPetals with path:', imagePath?.substring(0, 20) + '...');
  try {
    console.log('Resizing input image...');
    const image = await resizeImage(imagePath);
    const imageInfo = getMatInfo(image);
    console.log('Image resized:', imageInfo.rows, 'x', imageInfo.cols);
    
    // Create a copy of the original resized image to return
    console.log('Creating image copy for return...');
    const imageToReturn = OpenCV.invoke('clone', image);

    console.log('Applying median blur...');
    const rgb = OpenCV.createObject(ObjectType.Mat, imageInfo.rows, imageInfo.cols, imageInfo.type);
    OpenCV.invoke('medianBlur', image, rgb, 5);

    // debugging visual layer
    const rgbBlurBase64 = OpenCV.toJSValue(rgb, 'jpeg').base64;

    console.log('Converting to HSV...');
    const rgbInfo = getMatInfo(rgb);
    const hsv = OpenCV.createObject(ObjectType.Mat, rgbInfo.rows, rgbInfo.cols, rgbInfo.type);
    OpenCV.invoke('cvtColor', rgb, hsv, ColorConversionCodes.COLOR_BGR2HSV);

    console.log('Creating HSV mask...');
    const hsvInfo = getMatInfo(hsv);
    const hsvMask = OpenCV.createObject(ObjectType.Mat, hsvInfo.rows, hsvInfo.cols, DataTypes.CV_8U);
    
    // Use custom color parameters if provided, otherwise use defaults for yellow
    const defaultColor = {
      hueMin: 18, hueMax: 38,
      satMin: 60, satMax: 255,
      valMin: 60, valMax: 255
    };
    
    const color = colorParams || defaultColor;
    
    console.log('Using color parameters:', color);
    const lowerb = OpenCV.createObject(ObjectType.Scalar, 
      color.hueMin, color.satMin, color.valMin);
    const upperb = OpenCV.createObject(ObjectType.Scalar, 
      color.hueMax, color.satMax, color.valMax);

    OpenCV.invoke('inRange', hsv, lowerb, upperb, hsvMask);
    console.log('HSV mask created');

    hsvMaskBase64 = OpenCV.toJSValue(hsvMask, 'jpeg').base64;

    console.log('Converting to LAB...');
    const lab = OpenCV.createObject(ObjectType.Mat, rgbInfo.rows, rgbInfo.cols, rgbInfo.type);
    OpenCV.invoke('cvtColor', rgb, lab, ColorConversionCodes.COLOR_BGR2Lab);

    console.log('Splitting LAB channels...');
    const channelVec = OpenCV.createObject(ObjectType.MatVector);
    OpenCV.invoke('split', lab, channelVec);

    // Step 1: Debug metadata
    const vecInfo = OpenCV.toJSValue(channelVec);
    if (!vecInfo.array || vecInfo.array.length < 3) {
      throw new Error(`Invalid channels length: ${vecInfo.array.length}`);
    }
    console.log('Split into channels with dimensions:', vecInfo.array.map(c => `${c.rows}x${c.cols}`));

    // Step 2: Get the 'b' channel for processing
    const b = OpenCV.copyObjectFromVector(channelVec, 2);
    if (!b) throw new Error('Failed to extract B channel Mat');
    console.log('Extracted B-channel Mat, proxy id:', b.id);

    console.log('Applying Gaussian blur to b channel...');
    const bInfo = getMatInfo(b);
    const bBlur = OpenCV.createObject(ObjectType.Mat, bInfo.rows, bInfo.cols, bInfo.type);
    const kernelSize = OpenCV.createObject(ObjectType.Size, 5, 5);
    OpenCV.invoke('GaussianBlur', b, bBlur, kernelSize, 0);
    console.log('Gaussian blur applied');

    console.log('Applying Otsu threshold...');
    const bMask = OpenCV.createObject(ObjectType.Mat, bInfo.rows, bInfo.cols, DataTypes.CV_8U);
    OpenCV.invoke('threshold', bBlur, bMask, 0, 255, ThresholdTypes.THRESH_BINARY + ThresholdTypes.THRESH_OTSU);
    console.log('Otsu threshold applied and mask generated');

    bMaskBase64 = OpenCV.toJSValue(bMask, 'jpeg').base64;

    console.log('Creating yellow mask by combining HSV and b masks...');
    const hsvMaskInfo = getMatInfo(hsvMask);
    const yellowMask = OpenCV.createObject(ObjectType.Mat, hsvMaskInfo.rows, hsvMaskInfo.cols, DataTypes.CV_8U);
    OpenCV.invoke('bitwise_and', hsvMask, bMask, yellowMask);
    console.log('Yellow mask created');

    // For debugging
    const yellowMaskBase64 = OpenCV.toJSValue(yellowMask, 'jpeg').base64;

    console.log('Creating morphological kernel...');
    const size = OpenCV.createObject(ObjectType.Size, 5, 5);
    const kernel = OpenCV.invoke('getStructuringElement', MorphShapes.MORPH_ELLIPSE, size);

    console.log('Applying opening operation...');
    const yellowMaskInfo = getMatInfo(yellowMask);
    const opened = OpenCV.createObject(ObjectType.Mat, yellowMaskInfo.rows, yellowMaskInfo.cols, yellowMaskInfo.type);
    OpenCV.invoke('morphologyEx', yellowMask, opened, MorphTypes.MORPH_OPEN, kernel);

    openedMaskBase64 = OpenCV.toJSValue(opened, 'jpeg').base64;

    console.log('Applying closing operation...');
    const openedInfo = getMatInfo(opened);
    const closed = OpenCV.createObject(ObjectType.Mat, openedInfo.rows, openedInfo.cols, openedInfo.type);
    OpenCV.invoke('morphologyEx', opened, closed, MorphTypes.MORPH_CLOSE, kernel);

      // for debugging
    const closedMaskBase64 = OpenCV.toJSValue(closed, 'jpeg').base64;

    console.log('Finding largest component...');
    const largest = getLargestComponent(closed);
    console.log('Largest component found');

    const largestMaskBase64 = OpenCV.toJSValue(largest, 'jpeg').base64;

    console.log('Filling holes in mask...');
    const filled = fillHoles(largest);
    console.log('Holes filled');

    const filledMaskBase64 = OpenCV.toJSValue(filled, 'jpeg').base64;

    console.log('Finding non-zero coordinates...');
    const nonZeroPoints = OpenCV.createObject(ObjectType.PointVector);
    OpenCV.invoke('findNonZero', filled, nonZeroPoints);

    const { array: nonZero } = OpenCV.toJSValue(nonZeroPoints);
    console.log('Non-zero coordinates found, count:', nonZero.length);
    
    if (!nonZero || nonZero.length === 0) {
      throw new Error('No non-zero points found in the mask');
    }

    // NOTE: need to validate format of `nonZero` – assumed array of {x, y}
    console.log('Extracting coordinate arrays...');
    const xVals = nonZero.map(p => p.x);
    const yVals = nonZero.map(p => p.y);
    console.log('X range:', Math.min(...xVals), '-', Math.max(...xVals));
    console.log('Y range:', Math.min(...yVals), '-', Math.max(...yVals));

    console.log('Calculating bounding box with padding:', pad);
    const filledInfo = getMatInfo(filled);
    const xMin = Math.max(0, Math.min(...xVals) - pad);
    const xMax = Math.min(filledInfo.cols, Math.max(...xVals) + pad);
    const yMin = Math.max(0, Math.min(...yVals) - pad);
    const yMax = Math.min(filledInfo.rows, Math.max(...yVals) + pad);
    console.log('Bounding box:', xMin, yMin, xMax, yMax);

    console.log('Cropping filled mask...');
    const cropped = OpenCV.createObject(
      ObjectType.Mat, 
      yMax - yMin,  // height
      xMax - xMin,  // width
      getMatInfo(filled).type  // same type as source
    );
    const roi = OpenCV.createObject(ObjectType.Rect, xMin, yMin, xMax - xMin, yMax - yMin);
    OpenCV.invoke('crop', filled, cropped, roi);
    console.log('Cropped mask created');
    const croppedInfo = getMatInfo(cropped);
    console.log('Cropped to', croppedInfo.rows, 'x', croppedInfo.cols);

    // Estimate center from non-zero points
    console.log('Calculating center of mass...');
    const centerX = Math.round(xVals.reduce((a, b) => a + b, 0) / xVals.length);
    const centerY = Math.round(yVals.reduce((a, b) => a + b, 0) / yVals.length);
    console.log('Center at:', centerX, centerY);

    console.log('Creating EDT input mask...');
    // Step 1: create empty matrix
    const edtInput = OpenCV.createObject(ObjectType.Mat, croppedInfo.rows, croppedInfo.cols, DataTypes.CV_8U);

    // Step 2: fill with white using a threshold trick
    OpenCV.invoke('threshold', edtInput, edtInput, 0, 255, ThresholdTypes.THRESH_BINARY_INV);

    console.log('Adjusting center for crop...');
    const adjustedCenterX = centerX - xMin;
    const adjustedCenterY = centerY - yMin;
    console.log('Adjusted center:', adjustedCenterX, adjustedCenterY);

    // Step 3: count non-zero before drawing center
    const preDrawStats = OpenCV.invoke('countNonZero', edtInput);
    console.log('Non-zero before drawing center:', preDrawStats.value);

    // Step 4: draw a black dot at the center
    console.log('Drawing center point...');
    const centerPoint = OpenCV.createObject(ObjectType.Point, adjustedCenterX, adjustedCenterY);
    const black = OpenCV.createObject(ObjectType.Scalar, 0);
    OpenCV.invoke(
      'circle',
      edtInput,
      centerPoint,
      1,
      black,
      -1,
      LineTypes.LINE_8
    );

    const edtInputMaskBase64 = OpenCV.toJSValue(edtInput, 'jpeg').base64;

    // Step 5: confirm change
    const postDrawStats = OpenCV.invoke('countNonZero', edtInput);
    console.log('Non-zero after drawing center:', postDrawStats.value);
    console.log('Non-zero difference:', preDrawStats.value - postDrawStats.value);

    console.log('Computing distance transform...');
    const edt = OpenCV.createObject(ObjectType.Mat, croppedInfo.rows, croppedInfo.cols, DataTypes.CV_32F);
    OpenCV.invoke('distanceTransform', edtInput, edt, DistanceTypes.DIST_L2, 5);
    console.log('Distance transform computed');

    const edtInfo = getMatInfo(edt);
    const edtNormalized = OpenCV.createObject(ObjectType.Mat, edtInfo.rows, edtInfo.cols, DataTypes.CV_8U);
    OpenCV.invoke('normalize', edt, edtNormalized, 0, 255, 1); // NORM_MINMAX = 1
    const edtMaskBase64 = OpenCV.toJSValue(edtNormalized, 'jpeg').base64;

    console.log('Finding maximum radius...');
    const { maxVal: maxRadius } = OpenCV.invoke('minMaxLoc', edt);
    console.log('Max radius:', maxRadius);

    console.log('Converting EDT to buffer...');
    const edtBuf = OpenCV.matToBuffer(edt, 'float32');
    const { rows, cols, buffer } = edtBuf;
    console.log('Buffer received, dimensions:', rows, 'x', cols);
    
    console.log('Creating Float32Array from buffer...');
    const floatArr = new Float32Array(buffer);
    console.log('Float array created, length:', floatArr?.length);

    console.log('Converting float array to 2D array...');
    const edtArray = [];
    // Convert flat float array to 2D array
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        row.push(floatArr[y * cols + x]);
      }
      edtArray.push(row);
    }
    console.log('2D array created', edtArray?.length, 'x', edtArray[0]?.length);

    // console.log('Cleaning buffers...');
    // OpenCV.clearBuffers();

    // Compute persistence features
    console.log('Computing persistence features...');
    console.log('EDT array dimensions:', edtArray?.length, 'x', edtArray[0]?.length);
    const pers = persistence(edtArray);
    console.log('Persistence features computed, count:', pers?.length);
    
    if (!pers || pers.length === 0) {
      throw new Error('No persistence features found');
    }

    console.log('Sorting persistence features...');
    pers.sort((a, b) => b[0] - a[0]);
    console.log('Top 5 persistence values:', pers.slice(0, 5).map(p => p[0]));

    console.log('Determining persistence threshold...');
    const thresholdDist = maxRadius * 0.03;
    console.log('Threshold distance:', thresholdDist);
    
    console.log('Counting features above threshold...');
    let k = 1;
    while (k < pers.length && pers[k][0] > thresholdDist) k++;
    console.log('Features above threshold:', k);

    console.log('Extracting births and deaths...');
    // Transform coordinates back to original image space
    const births = pers.slice(0, k).map(p => {
      // p[2] contains [y, x] of each elder point
      return [p[2][0] + yMin, p[2][1] + xMin]; // Add offset to return to original image coordinates
    });

    const deaths = pers.slice(1, k).map(p => {
      // p[1] contains [y, x] of each saddle
      return [p[1][0] + yMin, p[1][1] + xMin]; // Add offset to return to original image coordinates
    });

    console.log('Births:', births?.length, 'Deaths:', deaths?.length);

    console.log("Births (sample):", births.slice(0, 5));
    console.log("Deaths (sample):", deaths.slice(0, 5));

    // Also return crop info for aligning results
    const maskBounds = {
      xMin,
      xMax,
      yMin,
      yMax,
    };

    console.log('Converting result image to base64...');
  
    const imageResult = OpenCV.toJSValue(imageToReturn, 'jpeg').base64;


    console.log('Cleaning buffers...');
    OpenCV.clearBuffers();

    const center = [adjustedCenterX + xMin, adjustedCenterY + yMin];

    
    
    console.log('countPetals complete, returning results with count:', k);
    return {
      count: k,
      maxRadius,
      thresholdDist,
      births,
      deaths,
      center,
      edtArray,
      maskBounds,
      image: imageResult,
      dimensions: {
        width: imageInfo.cols,
        height: imageInfo.rows
      },
      colorParams: color, // Add the color used for future reference
      rgbBlur: rgbBlurBase64,
      hsvMask: hsvMaskBase64,
      bMask: bMaskBase64,
      yellowMask: yellowMaskBase64,
      openedMask: openedMaskBase64,
      closedMask: closedMaskBase64,
      largestMask: largestMaskBase64,
      filledMask: filledMaskBase64,
      edtInputMask: edtInputMaskBase64,
      edtMask: edtMaskBase64,
    };

  } catch (err) {
    console.error('Error in countPetals:', err);
    console.error('Error details:', err.message);
    console.error('Error stack:', err.stack);
    
    try {
      console.log('Cleaning up OpenCV buffers...');
      OpenCV.clearBuffers();
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }
    
    throw err;
  }
}

export {
  countPetals,
  generateColorMask
};
