import { XPathDOMAdapter } from '@getodk/xpath';
import { EngineXPathNode } from './kind.ts';
export interface EngineDOMAdapter extends XPathDOMAdapter<EngineXPathNode> {
}
export declare const engineDOMAdapter: EngineDOMAdapter;
