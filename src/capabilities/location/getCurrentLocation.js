import * as Location from 'expo-location';

export class LocationCapabilityError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LocationCapabilityError';
    this.code = code;
  }
}

/**
 * Reads one foreground device position without imposing an XForms/geopoint
 * representation on callers.
 */
export async function getCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new LocationCapabilityError(
      'Location permission is required to get the current position.',
      'GATHER_LOCATION_PERMISSION_DENIED'
    );
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { coords, timestamp } = position;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    ...(Number.isFinite(coords.altitude) ? { altitude: coords.altitude } : {}),
    ...(Number.isFinite(coords.accuracy) ? { accuracy: coords.accuracy } : {}),
    ...(Number.isFinite(timestamp) ? { timestamp } : {}),
  };
}
