/**
 * Robust base64 encoding/decoding for Uint8Array.
 * Uses chunking to avoid call stack size limits on large data.
 */
export class Base64 {
  private static readonly CHUNK_SIZE = 0x8000; // 32KB chunks

  /**
   * Encode Uint8Array to base64 string
   */
  static encode(bytes: Uint8Array): string {
    let binary = '';
    
    // Process in chunks to avoid "Maximum call stack size exceeded"
    for (let i = 0; i < bytes.length; i += this.CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + this.CHUNK_SIZE);
      binary += String.fromCharCode(...chunk);
    }
    
    return btoa(binary);
  }

  /**
   * Decode base64 string to Uint8Array
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
