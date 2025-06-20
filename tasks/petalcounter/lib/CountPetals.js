const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cv = require('opencv4nodejs');
const { UnionFind, persistence } = require('./UnionFind');

async function resizeImage(inputPath) {
  const { width, height } = await sharp(inputPath).metadata();
  let newWidth, newHeight;
  if (width > height) {
    newWidth = 1024;
    newHeight = Math.round(height * (1024 / width));
  } else {
    newHeight = 1024;
    newWidth = Math.round(width * (1024 / height));
  }
  const buffer = await sharp(inputPath).resize(newWidth, newHeight).toBuffer();
  return cv.imdecode(buffer);
}

function getLargestComponent(binaryImg, minFraction = 0.1, minSize = null) {
  const stats = binaryImg.connectedComponentsWithStats();
  const { stats: statMat, labels } = stats;
  const totalPixels = binaryImg.countNonZero();

  const sizes = [];
  for (let i = 1; i < statMat.rows; i++) {
    sizes.push({
      label: i,
      size: statMat.at(i, cv.CC_STAT_AREA)
    });
  }

  if (minSize === null) {
    minSize = Math.max(...sizes.map(x => x.size)) + 1;
  }

  const validLabels = sizes
    .filter(x => x.size / totalPixels > minFraction || x.size > minSize)
    .map(x => x.label);

  const mask = new cv.Mat(binaryImg.rows, binaryImg.cols, cv.CV_8UC1, 0);
  for (let label of validLabels) {
    const region = labels.equal(label);
    mask.setTo(255, region);
  }

  return mask;
}

async function countPetals(imagePath, pad = 20) {
  const image = await resizeImage(imagePath);
  const rgb = image.medianBlur(5);

  const hsv = rgb.cvtColor(cv.COLOR_BGR2HSV);
  const hsvMask = hsv.inRange(new cv.Vec3(15, 40, 40), new cv.Vec3(45, 255, 255));

  const lab = rgb.cvtColor(cv.COLOR_BGR2Lab);
  const b = lab.split()[2];
  const bBlur = b.gaussianBlur(new cv.Size(5, 5), 0);
  const { threshold } = bBlur.threshold(0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
  const bMask = bBlur.threshold(threshold, 255, cv.THRESH_BINARY);

  const yellowMask = hsvMask.bitwiseAnd(bMask);

  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
  const opened = yellowMask.morphologyEx(kernel, cv.MORPH_OPEN);
  const closed = opened.morphologyEx(kernel, cv.MORPH_CLOSE);

  const largest = getLargestComponent(closed);
  const filled = largest.dilate(new cv.Mat(), new cv.Point(-1, -1), 1); // approximation

  const nonZero = filled.findNonZero();
  const xVals = nonZero.map(p => p.x);
  const yVals = nonZero.map(p => p.y);
  const xMin = Math.max(0, Math.min(...xVals) - pad);
  const xMax = Math.min(filled.cols, Math.max(...xVals) + pad);
  const yMin = Math.max(0, Math.min(...yVals) - pad);
  const yMax = Math.min(filled.rows, Math.max(...yVals) + pad);
  const cropped = filled.getRegion(new cv.Rect(xMin, yMin, xMax - xMin, yMax - yMin));

  // Distance transform
  const center = cropped.moments();
  const centerX = Math.round(center.m10 / center.m00);
  const centerY = Math.round(center.m01 / center.m00);

  const edtInput = new cv.Mat(cropped.rows, cropped.cols, cv.CV_8UC1, 1);
  edtInput.set(centerY, centerX, 0);
  const edt = edtInput.distanceTransform(cv.DIST_L2, 5);
  for (let y = 0; y < edt.rows; y++) {
    for (let x = 0; x < edt.cols; x++) {
      if (cropped.at(y, x) === 0) {
        edt.set(y, x, 0);
      }
    }
  }

  const maxRadius = edt.minMaxLoc().maxVal;

  // Convert to JS array for persistence
  const edtArray = [];
  for (let y = 0; y < edt.rows; y++) {
    edtArray.push([]);
    for (let x = 0; x < edt.cols; x++) {
      edtArray[y].push(edt.at(y, x));
    }
  }

  const pers = persistence(edtArray).sort((a, b) => b[0] - a[0]);
  const thresholdDist = maxRadius * 0.03;

  let k = 1;
  while (k < pers.length && pers[k][0] > thresholdDist) k++;

  const numPetals = k;
  return numPetals;
}

module.exports = {
  countPetals
};
