import { EngineXPathNode } from './kind.ts';
export declare const getEngineXPathNodeNamespaceURI: (node: EngineXPathNode) => string | null;
export declare const getEngineXPathNodeQualifiedName: (node: EngineXPathNode) => string;
export declare const getEngineXPathNodeLocalName: (node: EngineXPathNode) => string;
export declare const getEngineProcessingInstructionName: () => never;
export declare const resolveEngineXPathNodeNamespaceURI: (node: EngineXPathNode, prefix: string | null) => string | null;
