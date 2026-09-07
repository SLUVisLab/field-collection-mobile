import { BodyDefinition } from '../parse/body/BodyDefinition.ts';
import { ModelDefinition } from './model/ModelDefinition.ts';
import { XFormDOM } from './XFormDOM.ts';
export declare class XFormDefinition {
    readonly xformDOM: XFormDOM;
    readonly xformDocument: XMLDocument;
    readonly id: string;
    readonly title: string;
    readonly rootReference: string;
    readonly body: BodyDefinition;
    readonly model: ModelDefinition;
    constructor(xformDOM: XFormDOM);
}
