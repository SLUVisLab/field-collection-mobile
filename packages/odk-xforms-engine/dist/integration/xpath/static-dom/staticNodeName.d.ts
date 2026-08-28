import { QualifiedName, QualifiedNameSource } from '../../../lib/names/QualifiedName.ts';
export type StaticNodeNameSource = QualifiedName | QualifiedNameSource | string;
export declare const staticNodeName: (source: StaticNodeNameSource) => QualifiedName;
