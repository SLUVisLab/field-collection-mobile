import { Inflate } from 'pako';

import { MAX_QR_DECOMPRESSED_BYTES } from './collectSettingsQr.js';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Decode standard base64 without relying on Buffer (which Hermes does not
 * provide). Input syntax is validated by `parseCollectSettingsQr`.
 */
const decodeBase64 = (input) => {
  const outputLength = (input.length / 4) * 3 - (input.endsWith('==') ? 2 : input.endsWith('=') ? 1 : 0);
  const bytes = new Uint8Array(outputLength);
  let outputIndex = 0;

  for (let index = 0; index < input.length; index += 4) {
    const a = BASE64_ALPHABET.indexOf(input[index]);
    const b = BASE64_ALPHABET.indexOf(input[index + 1]);
    const c = input[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(input[index + 2]);
    const d = input[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(input[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw new Error('invalid base64');
    }
    const value = (a << 18) | (b << 12) | (c << 6) | d;
    if (outputIndex < outputLength) bytes[outputIndex++] = (value >> 16) & 0xff;
    if (outputIndex < outputLength) bytes[outputIndex++] = (value >> 8) & 0xff;
    if (outputIndex < outputLength) bytes[outputIndex++] = value & 0xff;
  }
  return bytes;
};

const decodeUtf8 = (bytes) => {
  if (typeof TextDecoder === 'function') {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  let encoded = '';
  for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, '0')}`;
  return decodeURIComponent(encoded);
};

/**
 * Expo/Hermes codec implementation. `Inflate` uses zlib wrapping by default.
 * Its output callback enforces the limit as data arrives, rather than accepting
 * an unbounded inflated allocation and checking it after the fact.
 */
export const createPakoSettingsQrCodec = () => ({
  decodeBase64,
  inflateZlib(compressed, { maxOutputBytes = MAX_QR_DECOMPRESSED_BYTES } = {}) {
    const inflater = new Inflate({ chunkSize: 16 * 1024 });
    const chunks = [];
    let size = 0;

    inflater.onData = (chunk) => {
      size += chunk.length;
      if (size > maxOutputBytes) {
        throw new Error('inflated payload exceeds allowed size');
      }
      chunks.push(chunk);
    };
    inflater.push(compressed, true);
    if (inflater.err || !inflater.ended) {
      throw new Error('invalid zlib payload');
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return decodeUtf8(bytes);
  },
});
