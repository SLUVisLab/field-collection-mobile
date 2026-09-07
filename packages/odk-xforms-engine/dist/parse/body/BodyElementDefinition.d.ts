import { DependencyContext } from '../expression/abstract/DependencyContext.ts';
import { HintDefinition } from '../text/HintDefinition.ts';
import { ItemLabelDefinition } from '../text/ItemLabelDefinition.ts';
import { LabelDefinition } from '../text/LabelDefinition.ts';
import { XFormDefinition } from '../XFormDefinition.ts';
import { BodyDefinition, BodyElementParentContext } from './BodyDefinition.ts';
/**
 * These category names roughly correspond to each of the ODK XForms spec's
 * {@link https://getodk.github.io/xforms-spec/#body-elements | Body Elements}
 * tables.
 */
type BodyElementCategory = 'control' | 'structure' | 'support' | 'UNSUPPORTED';
export declare abstract class BodyElementDefinition<Type extends string> extends DependencyContext implements BodyElementParentContext {
    protected readonly form: XFormDefinition;
    readonly parent: BodyElementParentContext;
    readonly element: Element;
    static isCompatible(localName: string, element: Element): boolean;
    readonly body: BodyDefinition;
    abstract readonly category: BodyElementCategory;
    abstract readonly type: Type;
    readonly hint: HintDefinition | null;
    readonly label: ItemLabelDefinition | LabelDefinition | null;
    readonly reference: string | null;
    readonly parentReference: string | null;
    protected constructor(form: XFormDefinition, parent: BodyElementParentContext, element: Element);
    toJSON(): object;
}
type BodyElementDefinitionClass = Pick<typeof BodyElementDefinition, keyof typeof BodyElementDefinition>;
export type BodyElementDefinitionConstructor = BodyElementDefinitionClass & (new (form: XFormDefinition, element: Element) => BodyElementDefinition<any>);
type BodyElementDefinitionInstance = InstanceType<BodyElementDefinitionConstructor>;
export type TypedBodyElementDefinition<Type extends string> = Extract<BodyElementDefinitionInstance, {
    readonly type: Type;
}>;
export {};
