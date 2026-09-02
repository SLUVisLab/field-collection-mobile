import { ResultRow, ResultSection } from './ResultSection.jsx';

const round = (value) => (typeof value === 'number' ? Number(value.toFixed(2)) : value);

export function MeasurementResults({ measurements }) {
  return (
    <ResultSection title="Measurements">
      <ResultRow label="Area" value={`${measurements.area.value} ${measurements.area.unit}`} />
      <ResultRow label="Perimeter" value={`${round(measurements.perimeter.value)} ${measurements.perimeter.unit}`} />
      <ResultRow
        label="Bounds"
        value={`${measurements.boundingBox.width} x ${measurements.boundingBox.height} ${measurements.boundingBox.unit}`}
      />
      <ResultRow label="Sharpness" value={measurements.sharpness.score.toFixed(2)} />
    </ResultSection>
  );
}
