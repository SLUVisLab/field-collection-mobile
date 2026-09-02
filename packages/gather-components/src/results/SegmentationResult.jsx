import { Helper } from '../primitives.jsx';
import { ResultSection } from './ResultSection.jsx';

export function SegmentationResult({ segmentation }) {
  return (
    <ResultSection title="Segmentation">
      <Helper>{segmentation?.model?.id ? `Completed with ${segmentation.model.id}` : 'Segmentation completed'}</Helper>
    </ResultSection>
  );
}
