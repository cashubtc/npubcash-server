import { nip19, nip98 } from "nostr-tools";
import jwt from "jsonwebtoken";
import { AuthData, RawAuthToken, SuccessfullAuthData } from "../types";
import { createHash } from "crypto";

export async function verifyAuth(
  authHeader: string,
  url: string,
  method: string,
  userAgent: string,
  body?: any,
): Promise<AuthData> {
  try {
    if (authHeader.startsWith("Nostr") || authHeader.startsWith("nostr")) {
      let isValid: boolean;
      const event = await nip98
        .unpackEventFromToken(authHeader)
        .catch((err) => {
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
        data: {
          pubkey: event.pubkey,
          npub: nip19.npubEncode(event.pubkey),
          canWithdraw: true,
        },
      };
    } else if (authHeader.startsWith("Bearer")) {
      const hashedAgent = createHash("sha256").update(userAgent).digest("hex");
      const [_, token] = authHeader.split(" ");
      const parsedHeader = jwt.verify(
        token,
        process.env.JWT_SECRET!,
      ) as RawAuthToken;
      if (
        !parsedHeader.p ||
        !parsedHeader.u ||
        parsedHeader.u !== hashedAgent
      ) {
        return { authorized: false };
      }
      const data: SuccessfullAuthData = {
        authorized: true,
        data: {
          pubkey: parsedHeader.p,
          npub: nip19.npubEncode(parsedHeader.p),
          canWithdraw: false,
        },
      };
      if (parsedHeader.w) {
        data.data.canWithdraw = true;
      }
      return data;
    } else {
      return { authorized: false };
    }
  } catch (e) {
    return { authorized: false };
  }
}
