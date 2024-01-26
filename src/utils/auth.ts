import { nip19, nip98 } from "nostr-tools";
import { AuthData } from "../types";

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
