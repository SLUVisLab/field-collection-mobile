import { XFormsSpecViolationError } from './XFormsSpecViolationError.ts';
import { RankDefinition } from '../client/RankNode.ts';
import { UnsupportedBaseItemValueType } from '../lib/codecs/items/BaseItemCodec.ts';
export declare class RankValueTypeError extends XFormsSpecViolationError {
    constructor(definition: RankDefinition<UnsupportedBaseItemValueType>);
}
