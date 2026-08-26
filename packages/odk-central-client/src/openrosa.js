import { OdkCentralError, ODK_CENTRAL_ERROR_CODES } from './errors.js';

/**
 * Minimal, dependency-free OpenRosa helpers.
 *
 * These are deliberately small and tolerant string parsers rather than a full
 * XML DOM: React Native (Hermes) has no `DOMParser`, and pulling in an XML
 * library would violate the "smallest useful surface" goal. The formList and
 * OpenRosaResponse documents Central emits are simple and flat, so targeted
 * extraction is sufficient and easy to test. Harden if a real form ever breaks
 * these assumptions.
 */

const parseError = (message, details) =>
  new OdkCentralError(message, { code: ODK_CENTRAL_ERROR_CODES.PARSE, details });

const decodeXmlEntities = (value) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const extractTag = (block, tag) => {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeXmlEntities(match[1].trim()) : null;
};

/**
 * @typedef {{
 *   formId: string | null,
 *   name: string | null,
 *   version: string | null,
 *   hash: string | null,
 *   downloadUrl: string | null,
 *   manifestUrl: string | null
 * }} OpenRosaFormListing
 */

/**
 * Parses an OpenRosa `formList` document into structured entries.
 *
 * Expected shape (namespace `http://openrosa.org/xforms/xformsList`):
 *
 * ```xml
 * <xforms><xform>
 *   <formID>simple</formID><name>Simple</name><version>1</version>
 *   <hash>md5:...</hash>
 *   <downloadUrl>https://.../simple.xml</downloadUrl>
 *   <manifestUrl>https://.../manifest</manifestUrl>
 * </xform></xforms>
 * ```
 *
 * @param {string} xml
 * @returns {OpenRosaFormListing[]}
 */
export const parseFormList = (xml) => {
  if (typeof xml !== 'string' || xml.trim().length === 0) {
    throw parseError('parseFormList requires a non-empty XML string');
  }
  const entries = [];
  const xformRegex = /<xform(?:\s[^>]*)?>([\s\S]*?)<\/xform>/gi;
  let match;
  while ((match = xformRegex.exec(xml)) != null) {
    const block = match[1];
    entries.push({
      formId: extractTag(block, 'formID'),
      name: extractTag(block, 'name'),
      version: extractTag(block, 'version'),
      hash: extractTag(block, 'hash'),
      downloadUrl: extractTag(block, 'downloadUrl'),
      manifestUrl: extractTag(block, 'manifestUrl'),
    });
  }
  return entries;
};

/**
 * Parses the `<message>` from an OpenRosa submission response document.
 * @param {string | null} xml
 * @returns {{ message: string | null }}
 */
export const parseOpenRosaResponse = (xml) => {
  if (typeof xml !== 'string' || xml.length === 0) {
    return { message: null };
  }
  return { message: extractTag(xml, 'message') };
};

/**
 * @typedef {{
 *   name: string,
 *   contentType?: string,
 *   data?: string | Uint8Array | ArrayBuffer | Blob,
 *   uri?: string
 * }} SubmissionAttachment
 */

/**
 * @typedef {{
 *   name: string,
 *   filename: string,
 *   contentType: string,
 *   body: any
 * }} SubmissionPart
 */

/**
 * Builds the ordered list of multipart parts for an OpenRosa submission, as a
 * **pure descriptor** (no `FormData`, no I/O) so request shape is unit-testable.
 *
 * Per the OpenRosa Form Submission API the body carries one `xml_submission_file`
 * part plus one part per media attachment, named by its filename. Attachment
 * bytes are passed through opaquely as either inline `data` or a native file
 * `uri` reference — honoring the media boundary (the client never reads or
 * transforms attachment bytes).
 *
 * @param {{ xml: string, attachments?: SubmissionAttachment[], xmlFilename?: string }} params
 * @returns {SubmissionPart[]}
 */
export const buildSubmissionParts = ({ xml, attachments = [], xmlFilename = 'xml_submission_file' }) => {
  if (typeof xml !== 'string' || xml.trim().length === 0) {
    throw new OdkCentralError('buildSubmissionParts requires non-empty submission xml', {
      code: ODK_CENTRAL_ERROR_CODES.BAD_REQUEST,
    });
  }
  const parts = [
    {
      name: 'xml_submission_file',
      filename: xmlFilename,
      contentType: 'text/xml',
      body: xml,
    },
  ];
  for (const attachment of attachments) {
    if (attachment == null || typeof attachment.name !== 'string' || attachment.name.length === 0) {
      throw new OdkCentralError('Each submission attachment requires a name', {
        code: ODK_CENTRAL_ERROR_CODES.BAD_REQUEST,
        details: attachment,
      });
    }
    if (attachment.data == null && attachment.uri == null) {
      throw new OdkCentralError(`Attachment "${attachment.name}" needs data or a uri reference`, {
        code: ODK_CENTRAL_ERROR_CODES.BAD_REQUEST,
        details: attachment,
      });
    }
    parts.push({
      name: attachment.name,
      filename: attachment.name,
      contentType: attachment.contentType ?? 'application/octet-stream',
      body: attachment.data ?? { uri: attachment.uri, name: attachment.name, type: attachment.contentType },
    });
  }
  return parts;
};

/**
 * Adapter that materializes {@link SubmissionPart}s into a runtime `FormData`.
 * Kept separate from {@link buildSubmissionParts} so the pure descriptor can be
 * asserted in tests while this impure step is exercised at the edge.
 *
 * @param {SubmissionPart[]} parts
 * @param {{ FormDataImpl?: typeof FormData }} [options]
 * @returns {FormData}
 */
export const toFormData = (parts, { FormDataImpl = globalThis.FormData } = {}) => {
  if (typeof FormDataImpl !== 'function') {
    throw new OdkCentralError('No FormData implementation available in this runtime', {
      code: ODK_CENTRAL_ERROR_CODES.CONFIG,
    });
  }
  const form = new FormDataImpl();
  for (const part of parts) {
    if (typeof part.body === 'string') {
      // Represent XML/text parts as a Blob when available so a filename and
      // content type can be attached; fall back to a plain string otherwise.
      if (typeof globalThis.Blob === 'function') {
        form.append(part.name, new globalThis.Blob([part.body], { type: part.contentType }), part.filename);
      } else {
        form.append(part.name, part.body);
      }
    } else {
      form.append(part.name, part.body, part.filename);
    }
  }
  return form;
};
