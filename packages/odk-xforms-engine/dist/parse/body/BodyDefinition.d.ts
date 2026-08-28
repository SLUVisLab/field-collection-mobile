import { ParsedTokenList, TokenListParser } from '../../lib/TokenListParser.ts';
import { XFormDefinition } from '../../parse/XFormDefinition.ts';
import { DependencyContext } from '../expression/abstract/DependencyContext.ts';
import { InputControlDefinition } from './control/InputControlDefinition.ts';
import { RangeControlDefinition } from './control/RangeControlDefinition.ts';
import { RankControlDefinition } from './control/RankControlDefinition.ts';
import { AnySelectControlDefinition } from './control/SelectControlDefinition.ts';
import { TriggerControlDefinition } from './control/TriggerControlDefinition.ts';
import { UploadControlDefinition } from './control/UploadControlDefinition.ts';
import { GroupElementDefinition } from './GroupElementDefinition.ts';
import { RepeatElementDefinition } from './RepeatElementDefinition.ts';
import { UnsupportedBodyElementDefinition } from './UnsupportedBodyElementDefinition.ts';
export interface BodyElementParentContext {
    readonly body: BodyDefinition;
    readonly reference: string | null;
    readonly element: Element;
}
export type ControlElementDefinition = AnySelectControlDefinition | InputControlDefinition | RangeControlDefinition | RankControlDefinition | TriggerControlDefinition | UploadControlDefinition;
type SupportedBodyElementDefinition = ControlElementDefinition | GroupElementDefinition | RepeatElementDefinition;
export type AnyBodyElementDefinition = SupportedBodyElementDefinition | UnsupportedBodyElementDefinition;
export type BodyElementDefinitionArray = readonly AnyBodyElementDefinition[];
export type AnyBodyElementType = AnyBodyElementDefinition['type'];
export type AnyControlElementDefinition = Extract<AnyBodyElementDefinition, {
    readonly category: 'control';
}>;
export declare const controlElementDefinition: (element: AnyBodyElementDefinition) => AnyControlElementDefinition | null;
type BodyElementReference = string;
declare class BodyElementMap extends Map<BodyElementReference, AnyBodyElementDefinition> {
    constructor(elements: BodyElementDefinitionArray);
    protected mapElementsByReference(elements: BodyElementDefinitionArray): void;
    set(reference: BodyElementReference, element: AnyBodyElementDefinition): this;
    getBodyElementType(reference: BodyElementReference): AnyBodyElementType | null;
    toJSON(): {
        [k: string]: AnyBodyElementDefinition;
    };
}
declare const bodyClassParser: TokenListParser<"pages", "pages">;
export type BodyClassList = ParsedTokenList<typeof bodyClassParser>;
export declare class BodyDefinition extends DependencyContext implements BodyElementParentContext {
    protected readonly form: XFormDefinition;
    readonly body: BodyDefinition;
    readonly element: Element;
    /**
     * @todo this class is already an oddity in that it's **like** an element
     * definition, but it isn't one itself. Adding this property here emphasizes
     * that awkwardness. It also extends the applicable scope where instances of
     * this class are accessed. While it's still ephemeral, it's anticipated that
     * this extension might cause some disomfort. If so, the most plausible
     * alternative is an additional refactor to:
     *
     * 1. Introduce a `BodyElementDefinition` sublass for `<h:body>`.
     * 2. Disambiguate the respective names of those, in some reasonable way.
     * 3. Add a layer of indirection between this class and that new body element
     *    definition's class.
     * 4. At that point, we may as well prioritize the little bit of grunt work to
     *    pass the `BodyDefinition` instance by reference rather than assigning it
     *    to anything.
     */
    readonly classes: BodyClassList;
    readonly elements: readonly AnyBodyElementDefinition[];
    protected readonly elementsByReference: BodyElementMap;
    readonly parentReference: null;
    readonly reference: string;
    constructor(form: XFormDefinition);
    getBodyElement(reference: string): AnyBodyElementDefinition | null;
    getBodyElementType(reference: BodyElementReference): AnyBodyElementType | null;
    getChildElementDefinitions(form: XFormDefinition, parent: BodyElementParentContext, parentElement: Element, children?: readonly Element[]): readonly AnyBodyElementDefinition[];
    toJSON(): Omit<this, "form" | "toJSON" | "isTranslated" | "getBodyElement" | "getBodyElementType" | "getChildElementDefinitions">;
}
export {};
