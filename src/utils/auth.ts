import { nip19, nip98 } from "nostr-tools";

type AuthData =
  | { authorized: false }
  | { authorized: true; data: { pubkey: string; npub: string } };

export async function verifyAuth(
  authHeader: string,
  url: string,
  method: string,
  body?: any,
): Promise<AuthData> {
  try {
    let isValid: boolean;
    const event = await nip98.unpackEventFromToken(authHeader).catch((err) => {
      throw err;
    });
    if (Boolean(body) && Object.keys(body).length > 0) {
      isValid = await nip98.validateEvent(event, url, method, body);
    } else {
      isValid = await nip98.validateEvent(event, url, method);
    }
    if (!isValid) {
      return { authorized: false };
    }
    return {
      authorized: true,
      data: { pubkey: event.pubkey, npub: nip19.npubEncode(event.pubkey) },
    };
  } catch (e) {
    return { authorized: false };
  }
}
