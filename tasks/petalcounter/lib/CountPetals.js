import {
  OpenCV,
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

console.log('CountPetals module loaded');

export async function resizeImage(inputUri) {
  console.log('🔄 Starting resizeImage with uri:', inputUri?.substring(0, 20) + '...');
  try {
    console.log('Getting image metadata...');
    // First, get metadata (dimensions) without any actions
    const meta = await ImageManipulator.manipulateAsync(inputUri, [], {
      base64: false,
    });
    console.log('Image metadata received:', meta?.width, 'x', meta?.height);

    const { width: origWidth, height: origHeight } = meta;

    // Calculate size capped at 1024px
    let newWidth, newHeight;
    if (origWidth > origHeight) {
      newWidth = 1024;
      newHeight = Math.round((origHeight * 1024) / origWidth);
    } else {
      newHeight = 1024;
      newWidth = Math.round((origWidth * 1024) / origHeight);
    }
    console.log('New dimensions:', newWidth, 'x', newHeight);

    // Resize, compress, and get base64
    console.log('Resizing image...');
    const result = await ImageManipulator.manipulateAsync(
      inputUri,
      [{ resize: { width: newWidth, height: newHeight } }],
      { compress: 1.0, format: ImageManipulator.SaveFormat.PNG, base64: true } // Try JPEG instead of PNG
    );
    console.log('Image resized, base64 length:', result?.base64?.length);

    // Convert base64 image to OpenCV Mat
    console.log('Converting to OpenCV Mat...');
    if (!OpenCV) {
      console.error('⚠️ OpenCV is undefined!');
      throw new Error('OpenCV module is undefined');
    }
    
    if (!result.base64) {
      console.error('⚠️ No base64 data in result!');
      throw new Error('No base64 data available');
    }
    
    try {
      // Check if base64 string starts with data URI prefix and remove if needed
      let base64Data = result.base64;
      if (base64Data.startsWith('data:')) {
        base64Data = base64Data.split(',')[1];
        console.log('Removed data URI prefix from base64');
      }
      
      console.log('Base64 first 20 chars:', base64Data.substring(0, 20));
      const mat = OpenCV.base64ToMat(base64Data);

      if (mat && typeof mat === 'object') {
        for (const [key, value] of Object.entries(mat)) {
          console.log(`🧪 Mat[${key}]:`, value);
        }
      }
      
      const matInfo = OpenCV.toJSValue(mat, 'png');
      console.log('✅ Mat info:', matInfo);

      if (!matInfo || !matInfo.rows || !matInfo.cols) {
        console.error('⚠️ Invalid Mat info:', matInfo);
        throw new Error('OpenCV returned unusable Mat data');
      }
      
      console.log('Conversion complete, Mat dimensions:', matInfo.rows, 'x', matInfo.cols);
      return mat;
    } catch (err) {
      console.error('⚠️ base64ToMat failed:', err);
      throw new Error(`base64ToMat failed: ${err.message}`);
    }
  } catch (err) {
    console.error('❌ Error resizing image for OpenCV:', err);
    throw err;
  }
}

export function fillHoles(binaryMask) {
  console.log('🔄 Starting fillHoles...');
  try {
    // Create a destination image to draw into (same size/type as binaryMask)
    console.log('Creating filled matrix...');
    const filled = OpenCV.createObject(
      ObjectType.Mat,
      binaryMask.rows,
      binaryMask.cols,
      binaryMask.type
    );
    console.log('Creating contour containers...');

    // Create empty contour container
    const contours = OpenCV.createObject(ObjectType.MatVector);
    const hierarchy = OpenCV.createObject(ObjectType.Mat);

    // Find contours
    console.log('Finding contours...');
    OpenCV.invoke(
      'findContours',
      binaryMask,
      contours,
      1,  // RETR_CCOMP
      2   // CHAIN_APPROX_SIMPLE
    );
    console.log('Found contours, count:', contours?.size?.());

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
    console.error('❌ Error in fillHoles:', err);
    throw err;
  }
}

function getLargestComponent(binaryImg, minFraction = 0.1, minSize = null) {
  console.log('🔄 Starting getLargestComponent...');
  try {
    const { rows, cols } = binaryImg;
    console.log('Input size:', rows, 'x', cols);
    
    console.log('Creating labels matrix...');
    const labels = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_32S);
    const stats = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_32S);
    const centroids = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_64F);

    console.log('Running connected components...');
    const { value: numLabels } = OpenCV.invoke(
      'connectedComponentsWithStats',
      binaryImg, labels, stats, centroids
    );
    console.log('Found', numLabels, 'connected components');

    console.log('Counting non-zero pixels...');
    const { value: totalPixels } = OpenCV.invoke('countNonZero', binaryImg);
    console.log('Total non-zero pixels:', totalPixels);

    console.log('Analyzing component sizes...');
    const sizes = [];
    for (let i = 1; i < numLabels; i++) {
      try {
        const area = OpenCV.invoke('Mat.at', stats, i, OpenCV.ConnectedComponentsTypes.CC_STAT_AREA).value;
        sizes.push({ label: i, size: area });
      } catch (err) {
        console.error('Error getting stats at index', i, ':', err);
      }
    }
    
    if (minSize === null && sizes.length) {
      minSize = Math.max(...sizes.map(x => x.size)) + 1;
      console.log('Using minSize:', minSize);
    }

    console.log('Filtering valid components...');
    const valid = sizes
      .filter(x => x.size / totalPixels > minFraction || x.size > minSize)
      .map(x => x.label);
    console.log('Valid components:', valid.length, 'of', sizes.length);

    console.log('Creating result mask...');
    const mask = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
    OpenCV.invoke('setTo', mask, OpenCV.createObject(ObjectType.Scalar, 0));

    console.log('Processing each valid component...');
    valid.forEach((label, index) => {
      try {
        console.log(`Processing component ${index + 1}/${valid.length} (label ${label})...`);
        const region = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
        OpenCV.invoke('compare', labels, label, region, CmpTypes.CMP_EQ);
        
        console.log('Copying to result mask...');
        const white = OpenCV.createObject(ObjectType.Mat, rows, cols, DataTypes.CV_8U);
        OpenCV.invoke('setTo', white, 255);
        OpenCV.invoke('copyTo', white, mask, region);
        
        console.log('Cleaning up temporary objects...');
        white.release();
        region.release();
      } catch (err) {
        console.error('Error processing component', label, ':', err);
      }
    });

    console.log('Cleaning up remaining buffers...');
    OpenCV.clearBuffers();
    console.log('getLargestComponent complete');
    return mask;
  } catch (err) {
    console.error('❌ Error in getLargestComponent:', err);
    throw err;
  }
}

async function countPetals(imagePath, pad = 20) {
  console.log('🔄 Starting countPetals with path:', imagePath?.substring(0, 20) + '...');
  try {
    console.log('Resizing input image...');
    const image = await resizeImage(imagePath);
    console.log('Image resized:', image?.rows, 'x', image?.cols);
    
    // Create a copy of the original resized image to return
    console.log('Creating image copy for return...');
    const imageToReturn = OpenCV.createObject(ObjectType.Mat);
    OpenCV.invoke('copy', image, imageToReturn);

    console.log('Applying median blur...');
    const rgb = OpenCV.createObject(ObjectType.Mat, image.rows, image.cols, image.type);
    OpenCV.invoke('medianBlur', image, rgb, 5);

    console.log('Converting to HSV...');
    const hsv = OpenCV.createObject(ObjectType.Mat, rgb.rows, rgb.cols, rgb.type);
    OpenCV.invoke('cvtColor', rgb, hsv, ColorConversionCodes.COLOR_BGR2HSV);

    console.log('Creating HSV mask...');
    const hsvMask = OpenCV.createObject(ObjectType.Mat, hsv.rows, hsv.cols, DataTypes.CV_8U);
    OpenCV.invoke('inRange', hsv, [15, 40, 40], [45, 255, 255], hsvMask);
    console.log('HSV mask created');

    console.log('Converting to LAB...');
    const lab = OpenCV.createObject(ObjectType.Mat, rgb.rows, rgb.cols, rgb.type);
    OpenCV.invoke('cvtColor', rgb, lab, ColorConversionCodes.COLOR_BGR2Lab);

    // NOTE: No verified way to split channels directly in JS – check return value
    console.log('Splitting LAB channels...');
    const channels = [];
    OpenCV.invoke('split', lab, channels);  // expect channels[2] to be 'b'
    console.log('Channels split, array length:', channels?.length);
    
    if (!channels || channels.length < 3) {
      throw new Error(`Invalid channels array: ${JSON.stringify(channels)}`);
    }
    
    const b = channels[2];
    if (!b) {
      throw new Error('Missing b channel');
    }
    console.log('B channel extracted');

    console.log('Applying Gaussian blur to b channel...');
    const bBlur = OpenCV.createObject(ObjectType.Mat, b.rows, b.cols, b.type);
    OpenCV.invoke('GaussianBlur', b, bBlur, [5, 5], 0);

    console.log('Finding Otsu threshold...');
    const bTemp = OpenCV.createObject(ObjectType.Mat, bBlur.rows, bBlur.cols, DataTypes.CV_8U);
    const { value: threshold } = OpenCV.invoke('threshold', bBlur, bTemp, 0, 255, ThresholdTypes.THRESH_BINARY + ThresholdTypes.THRESH_OTSU);
    console.log('Otsu threshold:', threshold);

    console.log('Applying threshold to b channel...');
    const bMask = OpenCV.createObject(ObjectType.Mat, bBlur.rows, bBlur.cols, DataTypes.CV_8U);
    OpenCV.invoke('threshold', bBlur, bMask, threshold, 255, ThresholdTypes.THRESH_BINARY);

    console.log('Creating yellow mask by combining HSV and b masks...');
    const yellowMask = OpenCV.createObject(ObjectType.Mat, hsvMask.rows, hsvMask.cols, DataTypes.CV_8U);
    OpenCV.invoke('bitwise_and', hsvMask, bMask, yellowMask);

    console.log('Creating morphological kernel...');
    const kernel = OpenCV.invoke('getStructuringElement', MorphTypes.MORPH_ELLIPSE, [5, 5]);

    console.log('Applying opening operation...');
    const opened = OpenCV.createObject(ObjectType.Mat, yellowMask.rows, yellowMask.cols, yellowMask.type);
    OpenCV.invoke('morphologyEx', yellowMask, opened, MorphTypes.MORPH_OPEN, kernel);

    console.log('Applying closing operation...');
    const closed = OpenCV.createObject(ObjectType.Mat, opened.rows, opened.cols, opened.type);
    OpenCV.invoke('morphologyEx', opened, closed, MorphTypes.MORPH_CLOSE, kernel);

    console.log('Finding largest component...');
    const largest = getLargestComponent(closed);
    console.log('Largest component found');

    console.log('Filling holes in mask...');
    const filled = fillHoles(largest);
    console.log('Holes filled');

    console.log('Finding non-zero coordinates...');
    const { value: nonZero } = OpenCV.invoke('findNonZero', filled);
    console.log('Non-zero coordinates found, count:', nonZero?.length);
    
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
    const xMin = Math.max(0, Math.min(...xVals) - pad);
    const xMax = Math.min(filled.cols, Math.max(...xVals) + pad);
    const yMin = Math.max(0, Math.min(...yVals) - pad);
    const yMax = Math.min(filled.rows, Math.max(...yVals) + pad);
    console.log('Bounding box:', xMin, yMin, xMax, yMax);

    console.log('Cropping filled mask...');
    const cropped = OpenCV.createObject(ObjectType.Mat);
    OpenCV.invoke('crop', filled, cropped, [xMin, yMin, xMax - xMin, yMax - yMin]);
    console.log('Cropped to', cropped?.rows, 'x', cropped?.cols);

    // Estimate center from non-zero points
    console.log('Calculating center of mass...');
    const centerX = Math.round(xVals.reduce((a, b) => a + b, 0) / xVals.length);
    const centerY = Math.round(yVals.reduce((a, b) => a + b, 0) / yVals.length);
    console.log('Center at:', centerX, centerY);

    console.log('Creating EDT input mask...');
    const edtInput = OpenCV.createObject(ObjectType.Mat, cropped.rows, cropped.cols, DataTypes.CV_8U);
    OpenCV.invoke('setTo', edtInput, 255); // Fill with ones

    // Adjust center for crop
    console.log('Adjusting center for crop...');
    const adjustedCenterX = centerX - xMin;
    const adjustedCenterY = centerY - yMin;
    console.log('Adjusted center:', adjustedCenterX, adjustedCenterY);

    console.log('Drawing center point...');
    OpenCV.invoke(
      'circle',
      edtInput,
      [adjustedCenterX, adjustedCenterY],
      1,
      OpenCV.createObject(ObjectType.Scalar, 0),
      -1
    );

    console.log('Computing distance transform...');
    const edt = OpenCV.createObject(ObjectType.Mat, cropped.rows, cropped.cols, DataTypes.CV_32F);
    OpenCV.invoke('distanceTransform', edtInput, edt, DistanceTypes.DIST_L2, 5);
    console.log('Distance transform computed');

    console.log('Finding maximum radius...');
    const { value: maxRadius } = OpenCV.invoke('minMaxLoc', edt);
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

    console.log('Cleaning buffers...');
    OpenCV.clearBuffers();

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
    // Slice out births and deaths
    const births = pers.slice(0, k).map(p => p[2]); // (x, y) of each elder
    const deaths = pers.slice(1, k).map(p => p[1]); // (x, y) of each saddle
    console.log('Births:', births?.length, 'Deaths:', deaths?.length);

    // Also return crop info for aligning results
    const maskBounds = {
      xMin,
      xMax,
      yMin,
      yMax,
    };

    // Convert the Mat to a base64 string for easy display
    console.log('Converting result image to base64...');
    const base64Image = OpenCV.matToBase64(imageToReturn);
    console.log('Base64 image created, length:', base64Image?.length);
    
    // Release the copied image
    console.log('Releasing resources...');
    imageToReturn.release();

    console.log('✅ countPetals complete, returning results with count:', k);
    return {
      count: k,
      maxRadius,
      thresholdDist,
      births,
      deaths,
      edtArray,
      maskBounds,
      image: base64Image,
      dimensions: {
        width: image.cols,
        height: image.rows
      }
    };

  } catch (err) {
    console.error('❌ Error in countPetals:', err);
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
  countPetals
};
