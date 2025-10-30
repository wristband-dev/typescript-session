/**
 * Base64 encoding and decoding utility for binary data.
 * 
 * Uses chunked processing to handle large binary data without exceeding
 * JavaScript's call stack size limits. Utilizes the browser's native `btoa()`
 * and `atob()` functions for the actual base64 conversion, but handles the
 * binary string conversion with chunking for reliability.
 * 
 * @internal
 */
export class Base64 {
  private static readonly CHUNK_SIZE = 0x8000; // 32KB chunks

  /**
   * Encode a Uint8Array to a base64-encoded string.
   * 
   * Processes the binary data in chunks to avoid call stack size limits
   * when converting bytes to character codes. Each chunk is converted to
   * a binary string, then all chunks are concatenated and base64-encoded.
   * 
   * @param bytes - Binary data to encode
   * @returns Base64-encoded string representation of the binary data
   * 
   * @example
   * ```typescript
   * const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
   * const encoded = Base64.encode(data);
   * console.log(encoded); // "SGVsbG8="
   * ```
   */
  static encode(bytes: Uint8Array): string {
    let binary = '';

    for (let i = 0; i < bytes.length; i += this.CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + this.CHUNK_SIZE);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  /**
   * Decode a base64-encoded string to a Uint8Array.
   * 
   * First decodes the base64 string to a binary string using `atob()`,
   * then converts each character in the binary string to its corresponding
   * byte value in a Uint8Array.
   * 
   * @param base64 - Base64-encoded string to decode
   * @returns Uint8Array containing the decoded binary data
   * @throws {DOMException} If the base64 string is malformed or contains invalid characters
   * 
   * @example
   * ```typescript
   * const encoded = "SGVsbG8=";
   * const decoded = Base64.decode(encoded);
   * console.log(decoded); // Uint8Array(5) [72, 101, 108, 108, 111]
   * console.log(String.fromCharCode(...decoded)); // "Hello"
   * ```
   */
  static decode(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return bytes;
  }
}
