import { XFORMS_KNOWN_ATTRIBUTE, XFORMS_LOCAL_NAME, XFormsSecondaryInstanceMap } from '@getodk/xpath';
import { EngineXPathNode } from '../../../integration/xpath/adapter/kind.ts';
import { StaticDocument } from '../../../integration/xpath/static-dom/StaticDocument.ts';
import { StaticElement } from '../../../integration/xpath/static-dom/StaticElement.ts';
import { XFormDOM } from '../../XFormDOM.ts';
import { ExternalSecondaryInstanceResourceLoadOptions } from './sources/ExternalSecondaryInstanceResource.ts';
export interface SecondaryInstanceDefinition extends StaticDocument {
    readonly rootDocument: SecondaryInstanceDefinition;
    readonly root: SecondaryInstanceRootDefinition;
}
export interface SecondaryInstanceRootDefinition extends StaticElement {
    readonly [XFORMS_LOCAL_NAME]: 'instance';
    readonly [XFORMS_KNOWN_ATTRIBUTE]: 'id';
    readonly rootDocument: SecondaryInstanceDefinition;
    readonly root: SecondaryInstanceRootDefinition;
    getAttributeValue(localName: 'id'): string;
    getAttributeValue(localName: string): string | null;
}
export declare class SecondaryInstancesDefinition extends Map<string, SecondaryInstanceRootDefinition> implements XFormsSecondaryInstanceMap<EngineXPathNode> {
    /**
     * @package Only to be used for testing
     */
    static loadSync(xformDOM: XFormDOM): SecondaryInstancesDefinition;
    static load(xformDOM: XFormDOM, options: ExternalSecondaryInstanceResourceLoadOptions): Promise<SecondaryInstancesDefinition>;
    private constructor();
}
