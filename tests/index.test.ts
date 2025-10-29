import { SessionCrypto } from './../src/core/crypto';

describe('SessionCrypto Cross-Compatibility', () => {
  const secret = 'a'.repeat(32);
  const data = { userId: '123' };
  const maxAge = 3600; // 1 hour

  test('encrypt() -> decrypt()', async () => {
    const encrypted = await SessionCrypto.encrypt(data, secret);
    const decrypted = await SessionCrypto.decrypt(encrypted, secret, maxAge);
    expect(decrypted).toEqual(data);
  });

  test('encryptSync() -> decryptSync()', () => {
    const encrypted = SessionCrypto.encryptSync(data, secret);
    const decrypted = SessionCrypto.decryptSync(encrypted, secret, maxAge);
    expect(decrypted).toEqual(data);
  });

  test('encrypt() -> decryptSync() [cross-platform]', async () => {
    const encrypted = await SessionCrypto.encrypt(data, secret);
    const decrypted = SessionCrypto.decryptSync(encrypted, secret, maxAge);
    expect(decrypted).toEqual(data);
  });

  test('encryptSync() -> decrypt() [cross-platform]', async () => {
    const encrypted = SessionCrypto.encryptSync(data, secret);
    const decrypted = await SessionCrypto.decrypt(encrypted, secret, maxAge);
    expect(decrypted).toEqual(data);
  });

  // test('TTL expiration', async () => {
  //   const encrypted = await SessionCrypto.encrypt(data, secret);
  //   // Wait or mock time to exceed maxAge
  //   await expect(
  //     SessionCrypto.decrypt(encrypted, secret, -10000) // Negative maxAge = instant expiry
  //   ).rejects.toThrow('expired');
  // });

  test('Tamper detection', async () => {
    const encrypted = await SessionCrypto.encrypt(data, secret);
    const tampered = encrypted.slice(0, -1) + 'X'; // Corrupt last char
    await expect(
      SessionCrypto.decrypt(tampered, secret, maxAge)
    ).rejects.toThrow();
  });

  test('Secret rotation', async () => {
    const oldSecret = 'old'.repeat(11);
    const newSecret = 'new'.repeat(11);
    
    const encrypted = await SessionCrypto.encrypt(data, oldSecret);
    const decrypted = await SessionCrypto.decryptWithSecrets(
      encrypted,
      [newSecret, oldSecret],
      maxAge
    );
    expect(decrypted).toEqual(data);
  });
});
