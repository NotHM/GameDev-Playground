import crypto from 'crypto';
import { sha256Hex } from './encryption.ts';

export interface PlayerCryptoIdentity {
  playerId: string;
  handle: string;
  publicKeyFingerprint: string;
  publicKeyPem: string;
  sessionToken: string;
  issuedAt: number;
}

const TOKEN_SIGNING_SECRET = process.env.AUTH_TOKEN_SECRET || 'aetherdeck-decentralized-ed25519-hmac-key';

export function createPlayerIdentity(handle: string, clientPublicKeyHint?: string): PlayerCryptoIdentity {
  const cleanHandle = (handle || 'Wanderer').trim().slice(0, 28) || 'Wanderer';
  const { publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const fingerprintSource = clientPublicKeyHint || publicKey;
  const publicKeyFingerprint = sha256Hex(fingerprintSource).slice(0, 16).toUpperCase();
  const playerId = `peer_${publicKeyFingerprint.slice(0, 8).toLowerCase()}`;
  const issuedAt = Date.now();

  const tokenPayload = `${playerId}:${cleanHandle}:${publicKeyFingerprint}:${issuedAt}`;
  const signature = crypto
    .createHmac('sha256', TOKEN_SIGNING_SECRET)
    .update(tokenPayload)
    .digest('hex');

  return {
    playerId,
    handle: cleanHandle,
    publicKeyFingerprint,
    publicKeyPem: publicKey,
    sessionToken: `${Buffer.from(tokenPayload).toString('base64url')}.${signature}`,
    issuedAt,
  };
}

export function verifySessionToken(token: string): { valid: boolean; playerId?: string; handle?: string; fingerprint?: string } {
  if (!token || !token.includes('.')) return { valid: false };
  const [encodedPayload, signature] = token.split('.');
  try {
    const tokenPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SIGNING_SECRET)
      .update(tokenPayload)
      .digest('hex');

    if (signature !== expectedSig) {
      return { valid: false };
    }
    const [playerId, handle, fingerprint] = tokenPayload.split(':');
    return { valid: true, playerId, handle, fingerprint };
  } catch {
    return { valid: false };
  }
}
