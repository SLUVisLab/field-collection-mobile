import { XFormsItextTranslationMap, XFormsSecondaryInstanceMap, XFormsXPathEvaluator } from '@getodk/xpath';
import { PrimaryInstance } from '../../instance/PrimaryInstance.ts';
import { ItextTranslationRootDefinition } from '../../parse/model/ItextTranslationsDefinition.ts';
import { SecondaryInstanceRootDefinition } from '../../parse/model/SecondaryInstance/SecondaryInstancesDefinition.ts';
import { EngineXPathNode } from './adapter/kind.ts';
interface EngineXPathEvaluatorOptions {
    readonly rootNode: PrimaryInstance;
    readonly itextTranslationsByLanguage: XFormsItextTranslationMap<ItextTranslationRootDefinition>;
    readonly secondaryInstancesById: XFormsSecondaryInstanceMap<SecondaryInstanceRootDefinition>;
}
export declare class EngineXPathEvaluator extends XFormsXPathEvaluator<EngineXPathNode> {
    constructor(options: EngineXPathEvaluatorOptions);
}
export {};
