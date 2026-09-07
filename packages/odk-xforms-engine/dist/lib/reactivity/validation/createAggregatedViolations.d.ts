import { OpaqueReactiveObjectFactory } from '../../../client/OpaqueReactiveObjectFactory.ts';
import { AncestorNodeValidationState } from '../../../client/validation.ts';
import { AnyParentNode } from '../../../instance/hierarchy.ts';
interface AggregatedViolationsOptions {
    readonly clientStateFactory: OpaqueReactiveObjectFactory<AncestorNodeValidationState>;
}
export declare const createAggregatedViolations: (context: AnyParentNode, options: AggregatedViolationsOptions) => AncestorNodeValidationState;
export {};
