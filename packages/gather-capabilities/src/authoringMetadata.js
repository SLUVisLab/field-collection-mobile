/**
 * Pedagogical metadata — what a canonical invocation *looks like*.
 *
 * Deliberately **beside** `CAPABILITY_DEFINITIONS` rather than inside it. A
 * definition is the portable semantic and runtime contract that both hosts and
 * the packager consume; a representative binding path is UI-facing teaching
 * material and has no business in it.
 *
 * ```text
 * CapabilityDefinition            portable semantic/runtime contract
 *         +
 * CapabilityAuthoringMetadata     pedagogical only
 *         ↓
 * authoring catalog projection
 * ```
 *
 * Only what cannot be derived lives here. A signature says a `measure_area`
 * call takes a mask; it cannot say that `/working/mask` is the idiomatic place
 * to find one, that the call belongs in action position, or that its result
 * conventionally lands at `/working/area`. Everything derivable — identity,
 * parameters, return type, accepted profiles — keeps coming from the real
 * definition, and is never restated here.
 *
 * Keyed by **function name**, because that is what an authored document calls
 * and what the catalog advertises. `assertAuthoringMetadataMatches` gates the
 * two sets against each other so this cannot drift into a second registry:
 * a capability with no entry, or an entry for a function nobody declares, is a
 * failure rather than a silent gap.
 */
import { CAPABILITY_DEFINITIONS } from './definitions.js';

/**
 * `image.segment` is called as `image_segment`. One derivation, used wherever
 * the two namespaces meet, so a capability cannot be reached by a name nothing
 * else agrees on.
 */
export const functionNameFor = (capabilityId) => capabilityId.replace(/\./g, '_');

/** Host functions are ordinary Functions to an authoring browser, and need examples too. */
export const HOST_FUNCTION_METADATA = Object.freeze({
  gather_persistAsset: {
    category: 'Tool lifecycle',
    args: { capture: { path: '/working/capture' } },
    resultPath: '/working/image',
  },
  gather_completeComposition: {
    category: 'Tool lifecycle',
    args: { outputs: { image: { path: '/working/image' }, area: { path: '/working/area/value' } } },
    resultPath: null,
  },
});

/**
 * Representative arguments per capability function.
 *
 * `modelRef` is deliberately absent from the model-backed entries: omitting it
 * is what selects the distribution's default, and the default is the shape an
 * author should meet first. The explicit and bound forms are taught by the
 * Models surface, where a real ModelRef exists to show.
 */
export const CAPABILITY_AUTHORING_METADATA = Object.freeze({
  image_segment: { args: { image: { path: '/working/image' } }, resultPath: '/working/segmentation' },
  image_classify: { args: { image: { path: '/working/image' } }, resultPath: '/working/classification' },
  measure_area: { args: { mask: { path: '/working/mask' } }, resultPath: '/working/area' },
  measure_perimeter: { args: { mask: { path: '/working/mask' } }, resultPath: '/working/perimeter' },
  measure_boundingBox: { args: { mask: { path: '/working/mask' } }, resultPath: '/working/boundingBox' },
  measure_centroid: { args: { mask: { path: '/working/mask' } }, resultPath: '/working/centroid' },
  measure_color: {
    args: { image: { path: '/working/image' }, mask: { path: '/working/mask' } },
    resultPath: '/working/color',
  },
  measure_sharpness: {
    args: { image: { path: '/working/image' }, mask: { path: '/working/mask' } },
    resultPath: '/working/sharpness',
  },
});

export class AuthoringMetadataError extends Error {
  constructor(message, { missing = [], unknown = [] } = {}) {
    super(message);
    this.name = 'AuthoringMetadataError';
    this.code = 'GATHER_AUTHORING_METADATA';
    this.missing = missing;
    this.unknown = unknown;
  }
}

/**
 * Gates the metadata against the definitions, in both directions.
 *
 * @param {{ definitions?: Array<object>, metadata?: object }} input
 */
export const assertAuthoringMetadataMatches = ({
  definitions = CAPABILITY_DEFINITIONS,
  metadata = CAPABILITY_AUTHORING_METADATA,
} = {}) => {
  const declared = definitions.map((definition) => functionNameFor(definition.id));
  const missing = declared.filter((name) => !metadata[name]);
  const unknown = Object.keys(metadata).filter((name) => !declared.includes(name));

  if (missing.length > 0 || unknown.length > 0) {
    throw new AuthoringMetadataError(
      [
        missing.length > 0 ? `no authoring example for ${missing.join(', ')}` : null,
        unknown.length > 0 ? `authoring example for undeclared ${unknown.join(', ')}` : null,
      ].filter(Boolean).join('; ') +
        '. This metadata teaches how to call what the definitions declare; it is not a second ' +
        'registry and may not carry entries the definitions do not.',
      { missing, unknown }
    );
  }
  return declared;
};

/**
 * The canonical invocation for one function, as an authored document holds it.
 *
 * Generated rather than written down, so a snippet cannot drift from the
 * contract it teaches. `resultPath` is Gather's action-position extension and is
 * omitted where a call produces nothing to route.
 */
export const usageExampleFor = ({ functionName, metadata }) => {
  if (!metadata) return null;
  const call = { call: functionName, args: metadata.args ?? {} };
  return metadata.resultPath
    ? { functionCall: call, resultPath: metadata.resultPath }
    : { functionCall: call };
};
