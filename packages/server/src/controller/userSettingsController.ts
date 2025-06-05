import { mintService, userService } from "@/config";
import { BadRequestError } from "@/errors";
import { normalizeUrl } from "@/utils/utils";
import { NextFunction, Request, Response } from "express";

export async function getUserSettings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      data: { pubkey },
    } = req.authData!;
    let user = await userService.getUserByPubkey(pubkey);
    if (!user) {
      user = userService.createNewUser(pubkey);
    }
    res.json({ error: false, data: { user } });
  } catch (e) {
    next(e);
  }
}

export async function updateUserSettingLock(
  req: Request<unknown, unknown, { lockQuotes: boolean }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      data: { pubkey },
    } = req.authData!;
    const { lockQuotes } = req.body;
    let user = await userService.getUserByPubkey(pubkey);
    if (!user) {
      user = userService.createNewUser(pubkey);
    }
    if (typeof lockQuotes !== "boolean") {
      throw new BadRequestError("Missing parameters");
    }
    //TODO: Reword function
    await mintService.checkMintUrl(user.mintUrl, lockQuotes);
    user.setQuoteLocking(lockQuotes);
    await userService.saveUser(user);
    res.json({ error: false, data: { user } });
  } catch (e) {
    next(e);
  }
}

export async function updateUserMintSetting(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authData = req.authData!;
    const { mint_url } = req.body;
    if (!mint_url) {
      throw new BadRequestError("Missing parameters!");
    }
    const parsedUrl = normalizeUrl(mint_url);
    let user = await userService.getUserByPubkey(authData.data.pubkey);
    await mintService.checkMintUrl(parsedUrl, user ? user.lockQuote : false);
    if (!user) {
      user = userService.createNewUser(authData.data.pubkey);
    }
    user.setPreferredMint(mint_url);
    await userService.saveUser(user);
    res.json({ error: false, data: { user } });
  } catch (e) {
    next(e);
  }
}
