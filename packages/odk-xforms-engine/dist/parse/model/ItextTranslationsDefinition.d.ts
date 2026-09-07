import { XFORMS_KNOWN_ATTRIBUTE, XFORMS_LOCAL_NAME, XFormsItextTranslationMap } from '@getodk/xpath';
import { StaticDocument } from '../../integration/xpath/static-dom/StaticDocument.ts';
import { StaticElement } from '../../integration/xpath/static-dom/StaticElement.ts';
import { XFormDOM } from '../XFormDOM.ts';
export interface ItextTranslationDefinition extends StaticDocument {
    readonly rootDocument: ItextTranslationDefinition;
    readonly root: ItextTranslationRootDefinition;
}
export interface ItextTranslationRootDefinition extends StaticElement {
    readonly [XFORMS_LOCAL_NAME]: 'translation';
    readonly [XFORMS_KNOWN_ATTRIBUTE]: 'lang';
    readonly root: ItextTranslationRootDefinition;
    readonly rootDocument: ItextTranslationDefinition;
}
export declare class ItextTranslationsDefinition extends Map<string, ItextTranslationRootDefinition> implements XFormsItextTranslationMap<ItextTranslationRootDefinition> {
    static from(xformDOM: XFormDOM): ItextTranslationsDefinition;
    private constructor();
}
