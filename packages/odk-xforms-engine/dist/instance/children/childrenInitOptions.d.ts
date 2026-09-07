import { ModelDefinition } from '../../parse/model/ModelDefinition.ts';
import { GeneralParentNode } from '../hierarchy.ts';
import { DescendantNodeInitOptions } from './DescendantNodeInitOptions.ts';
export interface ChildrenInitOptions {
    readonly parent: GeneralParentNode;
    readonly model: ModelDefinition;
    readonly children: readonly DescendantNodeInitOptions[];
}
export declare const childrenInitOptions: (parent: GeneralParentNode) => ChildrenInitOptions;
