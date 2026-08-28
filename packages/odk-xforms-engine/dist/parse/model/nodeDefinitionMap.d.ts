import { AnyNodeDefinition } from './NodeDefinition.ts';
import { RootDefinition } from './RootDefinition.ts';
export type NodesetReference = string;
export type NodeDefinitionMap = ReadonlyMap<NodesetReference, AnyNodeDefinition>;
export declare const nodeDefinitionMap: (root: RootDefinition) => NodeDefinitionMap;
