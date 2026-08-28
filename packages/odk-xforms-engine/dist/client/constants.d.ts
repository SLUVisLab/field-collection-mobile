export declare const MISSING_RESOURCE_BEHAVIOR: {
    /**
     * When this behavior is configured, {@link LoadForm | loading a form} which
     * references any **missing** resources will fail, producing an error to the
     * calling client.
     *
     * @see {@link MissingResourceBehavior}
     */
    readonly ERROR: "ERROR";
    /**
     * When this behavior is configured, {@link LoadForm | loading a form} which
     * references any **missing** resources will succeed (producing a warning).
     *
     * Such missing resources will be parsed as if they are blank, as appropriate
     * for the resource's XForm semantic usage and/or format.
     *
     * @see {@link MissingResourceBehavior}
     */
    readonly BLANK: "BLANK";
    /**
     * @see {@link MISSING_RESOURCE_BEHAVIOR.ERROR}
     */
    readonly DEFAULT: "ERROR";
};
export type MissingResourceBehaviorError = typeof MISSING_RESOURCE_BEHAVIOR.ERROR;
export type MissingResourceBehaviorBlank = typeof MISSING_RESOURCE_BEHAVIOR.BLANK;
export type MissingResourceBehaviorDefault = typeof MISSING_RESOURCE_BEHAVIOR.DEFAULT;
/**
 * Specifies behavior for {@link LoadForm | loading a form} which references any
 * **missing** resources.
 *
 * Here the term "missing" is consistent with
 * {@link https://www.rfc-editor.org/rfc/rfc9110#status.404 | HTTP 404 status}
 * semantics. Clients which provide access to form attachments by performing
 * HTTP network requests (e.g. with {@link fetch}) can generally convey this
 * semantic meaning with a standard {@link Response}.
 *
 * **IMPORTANT**
 *
 * The term "missing" is distinct from other network/IO failures, e.g. when
 * network access itself is unavailable. In these cases, the engine will
 * consider a resource's availability **ambiguous**, producing an error
 * regardless of the configured behavior for **missing** resources.
 */
export type MissingResourceBehavior = MissingResourceBehaviorError | MissingResourceBehaviorBlank;
export declare const INSTANCE_FILE_NAME = "xml_submission_file";
export type INSTANCE_FILE_NAME = typeof INSTANCE_FILE_NAME;
export declare const INSTANCE_FILE_TYPE = "text/xml";
export type INSTANCE_FILE_TYPE = typeof INSTANCE_FILE_TYPE;
