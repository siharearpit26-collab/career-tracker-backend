import { encrypt, decrypt } from '../../utils/encryption.utils';

describe('Encryption Utils', () => {
  it('should encrypt and decrypt a string correctly', () => {
    const original = 'my-secret-oauth-token-12345';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertexts for the same input (random IV)', () => {
    const original = 'same-text';
    const encrypted1 = encrypt(original);
    const encrypted2 = encrypt(original);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should handle empty strings', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe('');
  });

  it('should handle special characters', () => {
    const original = 'token!@#$%^&*()_+{}|:"<>?[];,./`~';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(original);
  });

  it('should handle long strings', () => {
    const original = 'a'.repeat(10000);
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(original);
  });

  it('should throw on invalid encrypted text format', () => {
    expect(() => decrypt('invalid-text')).toThrow('Invalid encrypted text format');
  });

  it('should throw on tampered ciphertext', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    parts[2] = 'tampered' + parts[2];
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow();
  });
});
