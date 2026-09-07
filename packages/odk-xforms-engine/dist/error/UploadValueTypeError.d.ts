import { UploadDefinition } from '../client/UploadNode.ts';
import { ValueType } from '../client/ValueType.ts';
import { XFormsSpecViolationError } from './XFormsSpecViolationError.ts';
type UnsupportedUploadValueType = Exclude<ValueType, 'binary'>;
export declare class UploadValueTypeError extends XFormsSpecViolationError {
    constructor(definition: UploadDefinition<UnsupportedUploadValueType>);
}
export {};
