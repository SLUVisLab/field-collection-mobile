export declare const XFORM_EVENT: {
    readonly odkInstanceLoad: "odk-instance-load";
    readonly odkInstanceFirstLoad: "odk-instance-first-load";
    readonly odkNewRepeat: "odk-new-repeat";
    readonly xformsRevalidate: "xforms-revalidate";
    readonly xformsValueChanged: "xforms-value-changed";
};
export type XFormEvent = (typeof XFORM_EVENT)[keyof typeof XFORM_EVENT];
