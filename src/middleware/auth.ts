import { NextFunction, Request, Response } from "express";
import { verifyAuth } from "../utils/auth";
import { AuthData } from "../types";
import { nip19, nip98 } from "nostr-tools";
import { verify } from "jsonwebtoken";

type AuthJWTPayload = {
  pubkey: string;
  expiresAt: number;
};
interface TokenVerifier {
  verify: (header: string, url: string, method: string) => Promise<AuthData>;
}

class NostrTokenVerifier implements TokenVerifier {
  async verify(header: string, url: string, method: string): Promise<AuthData> {
    try {
      let isValid: boolean;
      const event = await nip98.unpackEventFromToken(header).catch((err) => {
        throw err;
      });
      isValid = await nip98.validateEvent(event, url, method);
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
}

class JwtTokenVerifier implements TokenVerifier {
  async verify(header: string, _u: string, _m: string): Promise<AuthData> {
    try {
      const token = header.split(" ")[1];
      const decodedToken = verify(token, "secret") as AuthJWTPayload;
      return {
        authorized: true,
        data: {
          pubkey: decodedToken.pubkey,
          npub: nip19.npubEncode(decodedToken.pubkey),
        },
      };
    } catch {
      return { authorized: false };
    }
  }
}

class AuthHandler {
  private verifiers: { [tokenType: string]: TokenVerifier };

  setVerifier(tokenType: string, verifier: TokenVerifier) {
    this.verifiers[tokenType] = verifier;
  }

  getTokenType(header: string) {
    return header.split(" ")[0].toLowerCase();
  }

  async verifyToken(header: string, url: string, method: string) {
    const tokenType = this.getTokenType(header);
    if (this.verifiers[tokenType]) {
      const authData = await this.verifiers[tokenType].verify(
        header,
        url,
        method,
      );
      return authData;
    } else {
      throw new Error("unknown auth token type");
    }
  }
}

const authHandlerImpl = new AuthHandler();
authHandlerImpl.setVerifier("nostr", new NostrTokenVerifier());
authHandlerImpl.setVerifier("bearer", new JwtTokenVerifier());

export function isAuthMiddleware(path: string, method: string) {
  async function isAuth(req: Request, res: Response, next: NextFunction) {
    const hostname = req.header("host");
    const protocol = req.header("X-Forwarded-Proto");
    if (!hostname) {
      res.status(400);
      return next(new Error("Missing host header"));
    }
    const url = protocol + "://" + hostname + path;
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      res.status(401);
      return next(new Error("Missing Authorization Header"));
    }
    const isAuth = await verifyAuth(authHeader, url, method);
    if (!isAuth.authorized) {
      res.status(401);
      return next(new Error("Invalid Authorization Header"));
    } else {
      req.authData = isAuth;
    }
    next();
  }
  return isAuth;
}
