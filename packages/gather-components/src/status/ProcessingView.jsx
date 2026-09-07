import { ImageOverlay } from '../image/ImageOverlay.jsx';
import { Helper, Panel } from '../primitives.jsx';

export function ProcessingView({ image, label = 'Working…' }) {
  return (
    <Panel>
      <ImageOverlay image={image} />
      <Helper>{label}</Helper>
    </Panel>
  );
}
