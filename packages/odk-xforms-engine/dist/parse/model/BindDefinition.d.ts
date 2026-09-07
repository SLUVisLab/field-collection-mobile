import { DependencyContext } from '../expression/abstract/DependencyContext.ts';
import { BindComputationExpression } from '../expression/BindComputationExpression.ts';
import { MessageDefinition } from '../text/MessageDefinition.ts';
import { XFormDefinition } from '../XFormDefinition.ts';
import { BindElement } from './BindElement.ts';
import { AnyBindPreloadDefinition } from './BindPreloadDefinition.ts';
import { BindType, BindTypeDefinition } from './BindTypeDefinition.ts';
import { ModelDefinition } from './ModelDefinition.ts';
export declare class BindDefinition<T extends BindType = BindType> extends DependencyContext {
    readonly form: XFormDefinition;
    protected readonly model: ModelDefinition;
    readonly nodeset: string;
    readonly bindElement: BindElement;
    readonly type: BindTypeDefinition<T>;
    readonly parentNodeset: string | null;
    readonly maxPixels: number | null;
    readonly preload: AnyBindPreloadDefinition | null;
    readonly calculate: BindComputationExpression<'calculate'> | null;
    readonly readonly: BindComputationExpression<'readonly'>;
    readonly relevant: BindComputationExpression<'relevant'>;
    readonly required: BindComputationExpression<'required'>;
    /**
     * Diverges from
     * {@link https://github.com/getodk/javarosa/blob/059321160e6f8dbb3e81d9add61d68dd35b13cc8/dag.md | JavaRosa's},
     * which excludes `constraint` expressions. We compute `constraint`
     * dependencies like the other <bind> computation expressions, but explicitly
     * ignore self-references (this is currently handled by
     * {@link BindComputationExpression}, via its {@link DependentExpression}
     * super class).
     */
    readonly constraint: BindComputationExpression<'constraint'>;
    readonly constraintMsg: MessageDefinition<'constraintMsg'> | null;
    readonly requiredMsg: MessageDefinition<'requiredMsg'> | null;
    readonly saveIncomplete: BindComputationExpression<'saveIncomplete'>;
    protected _parentBind: BindDefinition | null | undefined;
    get parentBind(): BindDefinition | null;
    get reference(): string;
    get parentReference(): string | null;
    constructor(form: XFormDefinition, model: ModelDefinition, nodeset: string, bindElement: BindElement);
    toJSON(): Omit<this, "form" | "reference" | "parentReference" | "toJSON" | "isTranslated" | "model" | "bindElement" | "parentBind">;
}
