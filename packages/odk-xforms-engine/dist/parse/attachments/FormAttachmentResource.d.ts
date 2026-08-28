import { JRResourceURL } from '../../../../common/src/jr-resources/JRResourceURL.ts';
export type FormAttachmentDataType = 'media' | 'secondary-instance';
/**
 * @todo This type anticipates work to support media form attachments, which
 * will tend to be associated with binary data. The
 * expectation is that:
 *
 * - {@link Blob} would be appropriate for representing data from attachment
 *   resources which are conventionally loaded to completion (where network
 *   conditions are favorable), such as images
 *
 * - {@link MediaSource} or {@link ReadableStream} may be more appropriate for
 *   representing data from resources which are conventionally streamed in a
 *   browser context (often regardless of network conditions), such as video and
 *   audio
 */
export type FormAttachmentMediaData = Blob | MediaSource | ReadableStream<unknown>;
export type FormAttachmentSecondaryInstanceData = string;
type FormAttachmentData<DataType extends FormAttachmentDataType> = DataType extends 'media' ? FormAttachmentMediaData : FormAttachmentSecondaryInstanceData;
export declare abstract class FormAttachmentResource<DataType extends FormAttachmentDataType> {
    readonly dataType: DataType;
    readonly resourceURL: JRResourceURL;
    readonly data: FormAttachmentData<DataType>;
    protected constructor(dataType: DataType, resourceURL: JRResourceURL, data: FormAttachmentData<DataType>);
}
export {};
