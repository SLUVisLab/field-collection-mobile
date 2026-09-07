import { SharedValueCodec } from '../getSharedValueCodec.ts';
import { BaseItemCodec } from './BaseItemCodec.ts';
export type SingleValueSelectRuntimeValues = readonly [] | readonly [string];
/**
 * @see {@link encodeValueFactory}
 */
type SingleValueSelectCodecValues = readonly string[];
/**
 * Value codec implementation for `<select1>` controls.
 *
 * Note: this implementation is a specialization of the same principles
 * underlying {@link MultipleValueItemCodec}. It is implemented separately:
 *
 * 1. to address a semantic difference between `<select>` and `<select1>`
 *    values: the former are serialized as a space-separated list, but that does
 *    not apply to the latter;
 *
 * 2. as an optimization, as the more general implementation performs poorly on
 *    forms which we monitor for performance.
 */
export declare class SingleValueItemCodec extends BaseItemCodec<SingleValueSelectCodecValues> {
    constructor(baseCodec: SharedValueCodec<'string'>);
}
export {};
