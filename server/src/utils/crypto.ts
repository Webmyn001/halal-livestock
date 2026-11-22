import { createHash, randomBytes } from 'node:crypto';

/** URL safe without padding, so it can be dropped straight into an email link. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Only the digest is stored, so a leaked collection cannot be replayed as a token. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
