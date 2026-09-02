import { Image, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// Native media surface for the viewer: expo-video for playback, RN <Image> for
// photos. Isolated in the `.native` seam so the web bundle never pulls the native
// player. Device-validation pending for inline video playback (mirrors VideoView.native).
function NativeVideo({ uri }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.play();
  });
  return <VideoView player={player} style={styles.fill} contentFit="contain" allowsFullscreen nativeControls />;
}

export function MediaSurface({ kind, uri }) {
  if (!uri) return null;
  if (kind === 'video') return <NativeVideo uri={uri} />;
  return <Image source={{ uri }} style={styles.fill} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
