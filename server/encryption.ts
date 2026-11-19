import crypto from 'crypto';

export interface EncryptedEnvelope {
  cipherText: string;
  iv: string;
  authTag: string;
  algorithm: 'aes-256-gcm';
  timestamp: number;
}

const SERVER_MASTER_SECRET = process.env.P2P_MESH_SECRET || 'aetherdeck-p2p-mesh-256-bit-default-secret-key-2026';

function deriveKey(secret: string = SERVER_MASTER_SECRET): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptPacket(payload: unknown, secret?: string): EncryptedEnvelope {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plainText = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    algorithm: 'aes-256-gcm',
    timestamp: Date.now(),
  };
}

export function decryptPacket<T = unknown>(envelope: EncryptedEnvelope, secret?: string): T {
  const key = deriveKey(secret);
  const iv = Buffer.from(envelope.iv, 'hex');
  const authTag = Buffer.from(envelope.authTag, 'hex');
  const encryptedText = Buffer.from(envelope.cipherText, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  const text = decrypted.toString('utf8');
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
