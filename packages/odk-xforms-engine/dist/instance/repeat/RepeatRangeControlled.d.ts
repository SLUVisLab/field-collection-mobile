import { RepeatRangeNodeAppearances } from '../../client/repeat/BaseRepeatRangeNode.ts';
import { RepeatRangeControlledNode } from '../../client/repeat/RepeatRangeControlledNode.ts';
import { AncestorNodeValidationState } from '../../client/validation.ts';
import { XFormsXPathNodeRange } from '../../integration/xpath/adapter/XFormsXPathNode.ts';
import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { ControlledRepeatDefinition } from '../../parse/model/RepeatDefinition.ts';
import { GeneralParentNode } from '../hierarchy.ts';
import { EvaluationContext } from '../internal-api/EvaluationContext.ts';
import { BaseRepeatRange } from './BaseRepeatRange.ts';
export declare class RepeatRangeControlled extends BaseRepeatRange<ControlledRepeatDefinition> implements RepeatRangeControlledNode, XFormsXPathNodeRange, EvaluationContext {
    private readonly isInstanceCreation;
    readonly nodeType = "repeat-range:controlled";
    readonly appearances: RepeatRangeNodeAppearances;
    readonly validationState: AncestorNodeValidationState;
    constructor(parent: GeneralParentNode, instanceNodes: readonly StaticElement[], definition: ControlledRepeatDefinition);
    private initChildrenState;
    private applyCountChange;
    private resolveInstanceNodes;
}
