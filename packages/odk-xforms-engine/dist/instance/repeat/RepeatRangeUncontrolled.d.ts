import { RepeatRangeNodeAppearances } from '../../client/repeat/BaseRepeatRangeNode.ts';
import { RepeatRangeUncontrolledNode } from '../../client/repeat/RepeatRangeUncontrolledNode.ts';
import { AncestorNodeValidationState } from '../../client/validation.ts';
import { XFormsXPathNodeRange } from '../../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { UncontrolledRepeatDefinition } from '../../parse/model/RepeatDefinition.ts';
import { GeneralParentNode } from '../hierarchy.ts';
import { EvaluationContext } from '../internal-api/EvaluationContext.ts';
import { Root } from '../Root.ts';
import { BaseRepeatRange } from './BaseRepeatRange.ts';
export declare class RepeatRangeUncontrolled extends BaseRepeatRange<UncontrolledRepeatDefinition> implements RepeatRangeUncontrolledNode, XFormsXPathNodeRange, EvaluationContext {
    readonly nodeType = "repeat-range:uncontrolled";
    readonly appearances: RepeatRangeNodeAppearances;
    readonly validationState: AncestorNodeValidationState;
    constructor(parent: GeneralParentNode, instanceNodes: readonly StaticElement[], definition: UncontrolledRepeatDefinition);
    addInstances(afterIndex?: number, count?: number): Root;
    /**
     * Removes the {@link RepeatInstance}s corresponding to the specified range of
     * indexes, and then removes those repeat instances from the repeat range's
     * own children state in that order:
     *
     * 1. Identify the set of {@link RepeatInstance}s to be removed.
     *
     * 2. For each {@link RepeatInstance} pending removal, perform that node's
     *    removal logic. @see {@link RepeatInstance.remove} for more detail.
     *
     * 3. Finalize update to the repeat range's own {@link childrenState},
     *    omitting those {@link RepeatInstance}s which were removed.
     *
     * This ordering ensures a consistent representation of state is established
     * prior to any downstream reactive updates, and ensures that removed nodes'
     * reactivity is cleaned up.
     */
    removeInstances(startIndex: number, count?: number): Root;
}
