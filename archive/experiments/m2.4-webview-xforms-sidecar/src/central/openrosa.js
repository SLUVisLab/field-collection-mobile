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
 *   filename: string | null,
 *   hash: string | null,
 *   downloadUrl: string | null
 * }} OpenRosaManifestEntry
 */

/**
 * Parses an OpenRosa Form Manifest document into media/resource entries.
 *
 * This is the **OpenRosa field-client** resource-discovery path (usable by App
 * Users). It is intentionally distinct from Central's REST attachment listing;
 * see {@link OdkCentralClient.getFormManifest} vs
 * {@link OdkCentralClient.listFormAttachments}.
 *
 * Expected shape (namespace `http://openrosa.org/xforms/xformsManifest`):
 *
 * ```xml
 * <manifest><mediaFile>
 *   <filename>silphium-reference.jpg</filename>
 *   <hash>md5:...</hash>
 *   <downloadUrl>https://.../attachments/silphium-reference.jpg</downloadUrl>
 * </mediaFile></manifest>
 * ```
 *
 * Behavior:
 * - empty manifest (`<manifest></manifest>`) -> `[]`;
 * - one or many `<mediaFile>` -> one entry each;
 * - a `<mediaFile>` missing a child tag -> that field is `null` (tolerant);
 * - input that is not a manifest document -> throws a PARSE error (so a truly
 *   malformed/garbage response is not silently treated as "no attachments").
 *
 * @param {string} xml
 * @returns {OpenRosaManifestEntry[]}
 */
export const parseManifest = (xml) => {
  if (typeof xml !== 'string' || xml.trim().length === 0) {
    throw parseError('parseManifest requires a non-empty XML string');
  }
  if (!/<manifest[\s>]/i.test(xml)) {
    throw parseError('Not an OpenRosa manifest document', xml.slice(0, 200));
  }
  const entries = [];
  const mediaFileRegex = /<mediaFile(\s[^>]*)?>([\s\S]*?)<\/mediaFile>/gi;
  let match;
  while ((match = mediaFileRegex.exec(xml)) != null) {
    const attrs = match[1] ?? '';
    const block = match[2];
    const typeMatch = attrs.match(/\btype\s*=\s*"([^"]*)"/i);
    const type = typeMatch ? decodeXmlEntities(typeMatch[1].trim()) : null;
    entries.push({
      filename: extractTag(block, 'filename'),
      hash: extractTag(block, 'hash'),
      downloadUrl: extractTag(block, 'downloadUrl'),
      type,
      integrityUrl: extractTag(block, 'integrityUrl'),
      isEntityList: type === 'entityList',
    });
  }
  return entries;
};

/**
 * Extracts the `<instanceID>` (typically `uuid:...`) from a submission's
 * primary-instance XML, so callers can correlate a submission with its result.
 * @param {string} xml
 * @returns {string | null}
 */
export const extractInstanceId = (xml) => {
  if (typeof xml !== 'string' || xml.length === 0) {
    return null;
  }
  return extractTag(xml, 'instanceID');
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
export const buildSubmissionParts = ({ xml, attachments = [], xmlFilename = 'submission.xml' }) => {
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
 * This follows OpenRosa's multipart model directly: exactly one XML part named
 * `xml_submission_file` (with a real `submission.xml` filename), plus zero or
 * more attachment parts whose field name matches the reference in the XML. Each
 * part is appended as `append(fieldName, body, filename)` — the standard Web API
 * shape that both Node and React Native (`expo/fetch`) serialize as a proper
 * file part.
 *
 * Contract for attachment `data`: a **standards Blob-like body** supplied by the
 * caller (a `Blob`/`File`, or a platform file object such as an
 * `expo-file-system` `File`). The client does **not** wrap bodies in `File` or
 * branch on `instanceof File` (brittle across Node/browser/RN realms) — it only
 * wraps raw strings and byte containers (`ArrayBuffer`/typed arrays), which
 * runtime `FormData` cannot accept directly. Turning a native media URI into an
 * uploadable body is the application/platform adapter's responsibility.
 *
 * Note: never set a `Content-Type` header for the request — `FormData`/`fetch`
 * must generate the multipart boundary.
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
  const BlobImpl = globalThis.Blob;
  const isBytes = (v) =>
    (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(v)) || v instanceof ArrayBuffer;
  const form = new FormDataImpl();

  for (const part of parts) {
    const body = part.body;
    if (typeof body === 'string' || (body != null && isBytes(body))) {
      // Raw text/bytes must be wrapped so the part is a typed file part.
      if (typeof BlobImpl === 'function') {
        form.append(part.name, new BlobImpl([body], { type: part.contentType }), part.filename);
      } else {
        form.append(part.name, body);
      }
    } else {
      // A Blob-like body (Blob/File/platform file object) — standard append.
      form.append(part.name, body, part.filename);
    }
  }
  return form;
};
