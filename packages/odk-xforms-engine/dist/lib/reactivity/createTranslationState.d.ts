import { Accessor } from 'solid-js';
import { ActiveLanguage, FormLanguage, FormLanguages } from '../../client/FormLanguage.ts';
import { EngineXPathEvaluator } from '../../integration/xpath/EngineXPathEvaluator.ts';
import { ReactiveScope } from './scope.ts';
import { SimpleAtomicStateSetter } from './types.ts';
interface TranslationState {
    readonly languages: FormLanguages;
    readonly getActiveLanguage: Accessor<ActiveLanguage>;
    readonly setActiveLanguage: SimpleAtomicStateSetter<FormLanguage>;
}
/**
 * @todo It's been very silly all along that {@link XFormsXPathEvaluator} is
 * responsible for parsing translation languages, and maintaining the active
 * language state. It is especially silly now that we've moved _part of the
 * parsing_ up to the constructor call site. Let's finish off that awkwardness
 * in a subsequent refactor.
 */
export declare const createTranslationState: (scope: ReactiveScope, evaluator: EngineXPathEvaluator) => TranslationState;
export {};
