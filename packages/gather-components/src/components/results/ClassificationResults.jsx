import { Helper } from '../primitives.jsx';
import { ResultRow, ResultSection } from './ResultSection.jsx';

export function ClassificationResults({ classification }) {
  return (
    <ResultSection title="Classification">
      {classification?.ranked?.length ? (
        classification.ranked
          .slice(0, 3)
          .map((item) => <ResultRow key={item.label} label={item.label} value={`${(item.score * 100).toFixed(1)}%`} />)
      ) : (
        <Helper>Classification not run</Helper>
      )}
    </ResultSection>
  );
}
