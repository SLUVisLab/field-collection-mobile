import { SelectDefinition } from '../client/SelectNode.ts';
import { UnsupportedBaseItemValueType } from '../lib/codecs/items/BaseItemCodec.ts';
import { XFormsSpecViolationError } from './XFormsSpecViolationError.ts';
/**
 * @todo It would be good to have a standardized way to use specific types of
 * errors as a prompt for feedback. There is currently a feedback link presented
 * by `@getodk/web-forms`, which is conditionally displayed (condition is
 * evidently controlled by a
 * {@link https://vuejs.org/api/sfc-script-setup#defineoptions | Vue component option}).
 *
 * @see {@link https://github.com/getodk/web-forms/issues/276}
 */
export declare class SelectValueTypeError extends XFormsSpecViolationError {
    constructor(definition: SelectDefinition<UnsupportedBaseItemValueType>);
}
