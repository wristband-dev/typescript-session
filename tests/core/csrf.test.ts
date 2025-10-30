import { createCsrfToken } from '../../src/core/csrf';

describe('createCsrfToken', () => {
  describe('format and structure', () => {
    it('should generate a 64-character token', () => {
      const token = createCsrfToken();
      expect(token).toHaveLength(64);
    });

    it('should contain only hexadecimal characters', () => {
      const token = createCsrfToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be lowercase hexadecimal', () => {
      const token = createCsrfToken();
      // Should not contain uppercase A-F
      expect(token).not.toMatch(/[A-F]/);
      // Should only contain valid hex chars
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should not contain any whitespace', () => {
      const token = createCsrfToken();
      expect(token).not.toMatch(/\s/);
    });

    it('should not contain any special characters', () => {
      const token = createCsrfToken();
      // Only alphanumeric hex chars allowed
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('randomness and uniqueness', () => {
    it('should generate different tokens on each call', () => {
      const token1 = createCsrfToken();
      const token2 = createCsrfToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate unique tokens across multiple calls', () => {
      const tokens = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        tokens.add(createCsrfToken());
      }

      // All tokens should be unique
      expect(tokens.size).toBe(iterations);
    });

    it('should generate tokens with high entropy', () => {
      const tokens: string[] = [];
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        tokens.push(createCsrfToken());
      }

      // Check that tokens don't have common prefixes
      const firstChars = tokens.map(t => t.charAt(0));
      const uniqueFirstChars = new Set(firstChars);
      
      // With good randomness, we should see variety in first characters
      // Not all 16 possible hex chars, but definitely more than a few
      expect(uniqueFirstChars.size).toBeGreaterThan(5);
    });

    it('should not generate sequential or predictable tokens', () => {
      const token1 = createCsrfToken();
      const token2 = createCsrfToken();
      const token3 = createCsrfToken();

      // Tokens should not be similar (no common long substrings)
      // Check first 10 characters are different
      expect(token1.substring(0, 10)).not.toBe(token2.substring(0, 10));
      expect(token2.substring(0, 10)).not.toBe(token3.substring(0, 10));
      expect(token1.substring(0, 10)).not.toBe(token3.substring(0, 10));
    });
  });

  describe('entropy distribution', () => {
    it('should use all hexadecimal digits across multiple tokens', () => {
      const allChars = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const token = createCsrfToken();
        for (const char of token) {
          allChars.add(char);
        }
      }

      // With 100 tokens (6400 chars total), we should see all 16 hex digits
      expect(allChars.size).toBe(16);
      
      // Verify we have 0-9 and a-f
      expect(allChars.has('0')).toBe(true);
      expect(allChars.has('9')).toBe(true);
      expect(allChars.has('a')).toBe(true);
      expect(allChars.has('f')).toBe(true);
    });

    it('should have roughly uniform distribution of characters', () => {
      const charCounts: Record<string, number> = {};
      const iterations = 100;
      
      // Initialize counts
      '0123456789abcdef'.split('').forEach(char => {
        charCounts[char] = 0;
      });

      // Count character occurrences
      for (let i = 0; i < iterations; i++) {
        const token = createCsrfToken();
        for (const char of token) {
          charCounts[char]++;
        }
      }

      const totalChars = iterations * 64;
      const expectedPerChar = totalChars / 16; // ~400 for 100 iterations

      // Each character should appear roughly 1/16 of the time
      // Allow for statistical variance (e.g., within 50% of expected)
      Object.values(charCounts).forEach(count => {
        expect(count).toBeGreaterThan(expectedPerChar * 0.5);
        expect(count).toBeLessThan(expectedPerChar * 1.5);
      });
    });
  });

  describe('consistency', () => {
    it('should always return a string', () => {
      const token = createCsrfToken();
      expect(typeof token).toBe('string');
    });

    it('should not return null or undefined', () => {
      const token = createCsrfToken();
      expect(token).not.toBeNull();
      expect(token).not.toBeUndefined();
    });

    it('should not return an empty string', () => {
      const token = createCsrfToken();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate valid tokens in rapid succession', () => {
      const tokens: string[] = [];
      
      // Generate many tokens rapidly
      for (let i = 0; i < 1000; i++) {
        tokens.push(createCsrfToken());
      }

      // All should be valid
      tokens.forEach(token => {
        expect(token).toHaveLength(64);
        expect(token).toMatch(/^[0-9a-f]{64}$/);
      });

      // All should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(1000);
    });
  });

  describe('padding verification', () => {
    it('should properly pad single-digit hex values', () => {
      // Generate multiple tokens to ensure we encounter bytes that would be < 16
      // (which convert to single hex digit without padding)
      const tokens: string[] = [];
      
      for (let i = 0; i < 50; i++) {
        tokens.push(createCsrfToken());
      }

      // All tokens should be exactly 64 chars (meaning padding worked)
      tokens.forEach(token => {
        expect(token).toHaveLength(64);
        
        // Split into 2-char chunks and verify each is valid hex
        for (let i = 0; i < token.length; i += 2) {
          const hexByte = token.substring(i, i + 2);
          expect(hexByte).toHaveLength(2);
          expect(hexByte).toMatch(/^[0-9a-f]{2}$/);
        }
      });
    });

    it('should represent all 32 bytes with exactly 2 hex chars each', () => {
      const token = createCsrfToken();
      
      // 32 bytes * 2 hex chars per byte = 64 chars
      expect(token.length).toBe(64);
      
      // Should be divisible into 32 pairs
      for (let i = 0; i < 32; i++) {
        const hexByte = token.substring(i * 2, i * 2 + 2);
        expect(hexByte).toHaveLength(2);
        
        // Each pair should be valid hex (00-ff)
        const byteValue = parseInt(hexByte, 16);
        expect(byteValue).toBeGreaterThanOrEqual(0);
        expect(byteValue).toBeLessThanOrEqual(255);
      }
    });
  });
});
