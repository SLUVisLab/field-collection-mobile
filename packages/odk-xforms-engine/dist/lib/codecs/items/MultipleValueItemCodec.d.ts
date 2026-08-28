import { SharedValueCodec } from '../getSharedValueCodec.ts';
import { BaseItemCodec } from './BaseItemCodec.ts';
/**
 * Value codec implementation for `<select>` and `<odk:rank>` controls.
 *
 * This generalizes the application of a {@link SharedValueCodec} implementation
 * over individual select and rank values, where those values are serialized as a
 * whitespace-separated list. All other encoding and decoding logic is deferred
 * to the provided {@link baseCodec}, ensuring that select and rank value types are
 * treated consistently with the same underlying data types for other controls.
 */
export declare class MultipleValueItemCodec extends BaseItemCodec<readonly string[]> {
    constructor(baseCodec: SharedValueCodec<'string'>);
}
