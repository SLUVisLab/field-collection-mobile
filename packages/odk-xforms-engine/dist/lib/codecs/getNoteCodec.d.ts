import { ValueType } from '../../client/ValueType.ts';
import { NoteCodec } from './NoteCodec.ts';
export declare const getNoteCodec: <V extends ValueType>(valueType: V) => NoteCodec<V>;
