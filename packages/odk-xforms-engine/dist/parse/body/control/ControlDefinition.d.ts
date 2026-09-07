import { ParsedTokenList } from '../../../lib/TokenListParser.ts';
import { HintDefinition } from '../../text/HintDefinition.ts';
import { LabelDefinition } from '../../text/LabelDefinition.ts';
import { XFormDefinition } from '../../XFormDefinition.ts';
import { BodyElementParentContext } from '../BodyDefinition.ts';
import { BodyElementDefinition } from '../BodyElementDefinition.ts';
type ControlType = 'input' | 'range' | 'rank' | 'select' | 'select1' | 'trigger' | 'upload';
export declare abstract class ControlDefinition<Type extends ControlType> extends BodyElementDefinition<Type> {
    readonly category = "control";
    abstract readonly type: Type;
    readonly reference: string;
    readonly label: LabelDefinition | null;
    readonly hint: HintDefinition | null;
    abstract readonly appearances: ParsedTokenList<any>;
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
}
export type AnyControlDefinition = ControlDefinition<any>;
export {};
