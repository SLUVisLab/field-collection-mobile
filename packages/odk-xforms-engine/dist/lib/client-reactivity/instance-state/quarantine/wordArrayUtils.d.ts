import * as CryptoJS from 'crypto-js';
export declare const arrayBufferToWordArray: (buffer: Uint8Array<ArrayBuffer>) => CryptoJS.lib.WordArray;
export declare const wordArrayToArrayBuffer: (wordArray: CryptoJS.lib.WordArray) => Uint8Array<ArrayBuffer>;
