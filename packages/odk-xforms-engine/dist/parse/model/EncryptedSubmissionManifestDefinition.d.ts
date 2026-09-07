export declare class EncryptedSubmissionManifestDefinition {
    readonly formId: string;
    readonly formVersion: string | undefined;
    readonly instanceId: string;
    readonly encryptedSymmetricKey: string;
    readonly attachments: string[];
    constructor(formId: string, formVersion: string | undefined, instanceId: string, encryptedSymmetricKey: string, attachments: readonly File[]);
    serialize(): string;
}
