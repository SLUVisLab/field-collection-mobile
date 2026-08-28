import { LabelDefinition } from '../text/LabelDefinition.ts';
import { XFormDefinition } from '../XFormDefinition.ts';
import { StructureElementAppearanceDefinition } from './appearance/structureElementAppearanceParser.ts';
import { BodyElementDefinitionArray, BodyElementParentContext } from './BodyDefinition.ts';
import { BodyElementDefinition } from './BodyElementDefinition.ts';
/**
 * As per the spec: https://getodk.github.io/xforms-spec/#groups
 *
 * A group combines elements together.
 * The group can have a label, and if so is referred to as a "presentation group".
 * The group can have a ref, and if so is referred to as a "logical group".
 */
export declare class GroupElementDefinition extends BodyElementDefinition<'group'> {
    readonly category = "structure";
    readonly type = "group";
    readonly children: BodyElementDefinitionArray;
    readonly reference: string | null;
    readonly appearances: StructureElementAppearanceDefinition;
    readonly label: LabelDefinition | null;
    static isCompatible(localName: string): boolean;
    constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
}
