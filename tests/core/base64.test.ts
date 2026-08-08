import { Base64 } from '../../src/core/base64';

describe('Base64', () => {
  describe('encode', () => {
    it('should encode empty Uint8Array to empty string', () => {
      const input = new Uint8Array(0);
      const result = Base64.encode(input);
      expect(result).toBe('');
    });

    it('should encode simple ASCII text', () => {
      // "Hello"
      const input = new Uint8Array([72, 101, 108, 108, 111]);
      const result = Base64.encode(input);
      expect(result).toBe('SGVsbG8=');
    });

    it('should encode single byte', () => {
      const input = new Uint8Array([65]); // 'A'
      const result = Base64.encode(input);
      expect(result).toBe('QQ==');
    });

    it('should encode binary data with all byte values', () => {
      // Include all possible byte values 0-255
      const input = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        input[i] = i;
      }
      const result = Base64.encode(input);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);

      // Verify it's valid base64
      expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });

    it('should encode UTF-8 byte sequences', () => {
      // UTF-8 encoding of "Hello 世界" manually represented
      const input = new Uint8Array([
        72,
        101,
        108,
        108,
        111,
        32, // "Hello "
        228,
        184,
        150,
        231,
        149,
        140, // "世界"
      ]);
      const result = Base64.encode(input);
      expect(result).toBeTruthy();
      expect(result).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });

    it('should handle data exactly at chunk boundary (32KB)', () => {
      const chunkSize = 0x8000; // 32KB
      const input = new Uint8Array(chunkSize);
      input.fill(65); // Fill with 'A'

      const result = Base64.encode(input);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle data larger than chunk size', () => {
      const size = 0x8000 + 1000; // 32KB + 1000 bytes
      const input = new Uint8Array(size);

      // Fill with pattern to ensure chunks are processed correctly
      for (let i = 0; i < size; i++) {
        input[i] = i % 256;
      }

      const result = Base64.encode(input);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very large data (multiple chunks)', () => {
      const size = 0x8000 * 3 + 500; // ~96KB
      const input = new Uint8Array(size);
      input.fill(88); // Fill with 'X'

      const result = Base64.encode(input);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce consistent output for same input', () => {
      const input = new Uint8Array([1, 2, 3, 4, 5]);
      const result1 = Base64.encode(input);
      const result2 = Base64.encode(input);
      expect(result1).toBe(result2);
    });
  });

  describe('decode', () => {
    it('should decode empty string to empty Uint8Array', () => {
      const result = Base64.decode('');
      expect(result).toEqual(new Uint8Array(0));
      expect(result.length).toBe(0);
    });

    it('should decode simple base64 string', () => {
      const result = Base64.decode('SGVsbG8=');
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should decode base64 without padding', () => {
      const result = Base64.decode('SGVsbG8'); // No padding
      expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    it('should decode single character', () => {
      const result = Base64.decode('QQ==');
      expect(result).toEqual(new Uint8Array([65]));
    });

    it('should decode base64 with all byte values', () => {
      const original = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        original[i] = i;
      }
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should throw on invalid base64 characters', () => {
      expect(() => Base64.decode('!!!invalid!!!')).toThrow();
      expect(() => Base64.decode('SGVs^G8=')).toThrow();
      expect(() => Base64.decode('Hello@World')).toThrow(); // @ is invalid in base64
    });

    it('should throw on malformed base64 (odd length issues)', () => {
      // Base64 strings with invalid structure
      expect(() => Base64.decode('A')).toThrow();
    });

    it('should handle base64 with plus and slash characters', () => {
      // Base64 can contain + and /
      const base64WithSpecialChars = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5K/==';
      const result = Base64.decode(base64WithSpecialChars);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should decode large base64 strings', () => {
      const size = 0x8000 * 2; // 64KB
      const original = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        original[i] = i % 256;
      }
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });
  });

  describe('encode/decode roundtrip', () => {
    it('should successfully roundtrip empty data', () => {
      const original = new Uint8Array(0);
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should successfully roundtrip single byte', () => {
      const original = new Uint8Array([42]);
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should successfully roundtrip random data', () => {
      const original = new Uint8Array(100);
      for (let i = 0; i < original.length; i++) {
        original[i] = Math.floor(Math.random() * 256);
      }
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should successfully roundtrip data at chunk boundary', () => {
      const original = new Uint8Array(0x8000);
      original.fill(123);
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should successfully roundtrip data larger than chunk size', () => {
      const original = new Uint8Array(0x8000 + 5000);
      for (let i = 0; i < original.length; i++) {
        original[i] = i % 256;
      }
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should successfully roundtrip very large data', () => {
      const original = new Uint8Array(0x8000 * 5); // 160KB
      for (let i = 0; i < original.length; i++) {
        original[i] = (i * 7) % 256;
      }
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should successfully roundtrip all possible byte values', () => {
      const original = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        original[i] = i;
      }
      const encoded = Base64.encode(original);
      const decoded = Base64.decode(encoded);
      expect(decoded).toEqual(original);
    });
  });
});
