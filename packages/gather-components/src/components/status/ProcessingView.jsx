import { ImageOverlay } from '../image/ImageOverlay.jsx';
import { Helper, Panel } from '../primitives.jsx';

export function ProcessingView({ image, phase }) {
  const label = phase === 'measuring' ? 'Calculating measurements…' : 'Processing image…';
  return (
    <Panel>
      <ImageOverlay image={image} />
      <Helper>{label}</Helper>
    </Panel>
  );
}
