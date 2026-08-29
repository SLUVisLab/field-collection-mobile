import test from 'node:test';
import assert from 'node:assert/strict';
import { nextUnresolvedEntityId, pointGeometryFor, resolveTraversal } from '../../src/fieldwork/traversal.js';

const entities = [
  { entityId: 'b', label: 'Beta', properties: { site: 'B', row: '2', geometry: '38.5 -90.5 0 5' } },
  { entityId: 'a', label: 'Alpha', properties: { site: 'A', row: '1' } },
  { entityId: 'c', label: 'Gamma', properties: { site: 'A', row: '3', geometry: 'bad' } },
];

test('traversal keeps a session snapshot, filters, sorts, groups, and derives real states', () => {
  const instances = new Map([['a', { state: 'draft' }], ['b', { state: 'ready' }]]);
  const result = resolveTraversal({
    entities: [...entities, { entityId: 'new', label: 'New', properties: {} }],
    targetEntityIds: ['b', 'a', 'c'],
    filters: { site: 'A' }, sorting: [{ property: 'row', direction: 'desc' }], grouping: { property: 'site' },
    instancesByEntity: instances,
  });
  assert.deepEqual(result.entities.map((entity) => entity.entityId), ['c', 'a']);
  assert.equal(result.entities[1].state, 'draft');
  assert.equal(result.groups[0].name, 'A');
  assert.equal(result.counts.pending, 1);
  assert.equal(nextUnresolvedEntityId(result.entities, 'a'), null);
});

test('point geometry accepts only valid latitude longitude coordinates', () => {
  assert.deepEqual(pointGeometryFor(entities[0]), { type: 'Point', coordinates: [-90.5, 38.5] });
  assert.equal(pointGeometryFor(entities[2]), null);
});
