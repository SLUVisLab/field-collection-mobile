/**
 * Selects the first string payload from native barcode objects without passing
 * their native wrappers beyond the camera boundary.
 */
export const scannedCodeValue = (barcodes) => {
  if (!Array.isArray(barcodes)) return null;
  for (const barcode of barcodes) {
    if (typeof barcode?.rawValue === 'string' && barcode.rawValue.length > 0) {
      return barcode.rawValue;
    }
    if (typeof barcode?.displayValue === 'string' && barcode.displayValue.length > 0) {
      return barcode.displayValue;
    }
  }
  return null;
};
