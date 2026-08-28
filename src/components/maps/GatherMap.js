import { StyleSheet, View } from 'react-native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';

import { useTheme } from '../../theme/useTheme.js';

export const OPEN_FREE_MAP_LIBERTY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * A small direct MapLibre composition for the first native map surface. It
 * intentionally preserves MapLibre concepts rather than hiding them behind a
 * speculative map domain abstraction.
 */
export function GatherMap({
  centerCoordinate,
  zoomLevel = 12,
  points = [],
  styleURL = OPEN_FREE_MAP_LIBERTY_STYLE,
  onDidFinishLoadingMap,
  testID,
}) {
  const theme = useTheme();
  return (
    <View style={styles.container} testID={testID}>
      <Map
        style={styles.map}
        mapStyle={styleURL}
        onDidFinishLoadingMap={onDidFinishLoadingMap}
      >
        <Camera initialViewState={{ center: centerCoordinate, zoom: zoomLevel }} />
        {points.map((point) => (
          <Marker
            key={point.id}
            id={point.id}
            lngLat={point.coordinate}
          >
            <View style={[styles.marker, { backgroundColor: theme.colors.danger, borderColor: theme.colors.onDanger }]} />
          </Marker>
        ))}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 260, overflow: 'hidden' },
  map: { flex: 1 },
  marker: { borderRadius: 8, borderWidth: 2, height: 16, width: 16 },
});
