import { XFormDefinition } from '../XFormDefinition.ts';
import { BodyElementDefinitionArray, BodyElementParentContext } from '../body/BodyDefinition.ts';
import { LabelDefinition } from '../text/LabelDefinition.ts';
import { BodyElementDefinition } from './BodyElementDefinition.ts';
import { StructureElementAppearanceDefinition } from './appearance/structureElementAppearanceParser.ts';
export declare class RepeatElementDefinition extends BodyElementDefinition<'repeat'> {
    static isCompatible(localName: string): boolean;
    readonly category = "structure";
    readonly type = "repeat";
    readonly reference: string;
    readonly appearances: StructureElementAppearanceDefinition;
    readonly label: LabelDefinition | null;
    readonly countExpression: string | null;
    readonly noAddRemoveExpression: string | null;
    readonly children: BodyElementDefinitionArray;
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
    toJSON(): Omit<this, "parent" | "form" | "toJSON" | "isTranslated">;
}
