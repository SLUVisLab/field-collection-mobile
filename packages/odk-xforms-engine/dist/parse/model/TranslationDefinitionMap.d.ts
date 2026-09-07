import { DOMItextTranslationElement } from '../XFormDOM.ts';
export declare class TranslationDefinitionMap extends Map<string, Map<string, Element>> {
    constructor(translationElements: readonly DOMItextTranslationElement[]);
}
