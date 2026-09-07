import { SubmissionMeta } from '../../client/submission/SubmissionMeta.ts';
import { XFormDOM } from '../XFormDOM.ts';
export declare class SubmissionDefinition implements SubmissionMeta {
    readonly submissionAction: URL | null;
    readonly submissionMethod = "post";
    readonly encryptionKey: string | null;
    constructor(xformDOM: XFormDOM);
}
