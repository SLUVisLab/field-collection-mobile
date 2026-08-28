import { Submission } from '../prepareInstancePayload';
export declare const ENCRYPTED_SUFFIX = ".enc";
export declare const ENCRYPTED_SUBMISSION_ATTACHMENT_NAME = "submission.xml.enc";
export declare const encryptSubmission: (formId: string, formVersion: string | undefined, instanceId: string, instanceXML: string, attachments: readonly File[], encryptionKey: string) => Promise<Submission>;
