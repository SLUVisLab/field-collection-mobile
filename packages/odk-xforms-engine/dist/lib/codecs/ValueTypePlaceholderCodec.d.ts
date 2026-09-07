import { ValueType } from '../../client/ValueType.ts';
import { ValueCodec } from './ValueCodec.ts';
/**
 * Provides fallback functionality where a {@link ValueCodec} is expected, for
 * those {@link ValueType | value types} which are still pending implementation.
 * This allows consistent use of the {@link ValueCodec} interface while
 * maintaining the current behavior of treating those unimplemented value types
 * as string values.
 */
export declare class ValueTypePlaceholderCodec<V extends ValueType> extends ValueCodec<V, string, string> {
    constructor(valueType: V);
}
