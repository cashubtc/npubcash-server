import { nip98 } from "nostr-tools";

type AuthData =
  | { authorized: false }
  | { authorized: true; data: { pubkey: string } };

export async function verifyAuth(
  authHeader: string,
  url: string,
  method: string,
): Promise<AuthData> {
  try {
    const isValid = await nip98.validateToken(authHeader, url, method);
    if (!isValid) {
      return { authorized: false };
    }
    const event = await nip98.unpackEventFromToken(authHeader);
    return { authorized: true, data: { pubkey: event.pubkey } };
  } catch (e) {
    return { authorized: false };
  }
}
