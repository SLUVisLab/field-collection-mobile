import { SelectDefinition } from '../../client/SelectNode.ts';
import { MultipleValueItemCodec } from './items/MultipleValueItemCodec.ts';
import { SingleValueItemCodec } from './items/SingleValueItemCodec.ts';
export type SelectCodec = MultipleValueItemCodec | SingleValueItemCodec;
export declare const getSelectCodec: (definition: SelectDefinition<"string">) => SelectCodec;
