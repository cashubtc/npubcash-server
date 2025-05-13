import { userService } from "@/config";
import { BadRequestError } from "@/errors";
import { NextFunction, Request, Response } from "express";

export async function updateUserSettingLock(
  req: Request<unknown, unknown, { lock_quotes: boolean }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      data: { pubkey },
    } = req.authData!;
    const { lock_quotes } = req.body;
    let user = await userService.getUserByPubkey(pubkey);
    if (!user) {
      user = userService.createNewUser(pubkey);
    }
    if (typeof lock_quotes !== "boolean") {
      throw new BadRequestError("Missing parameters");
    }
    user.setQuoteLocking(lock_quotes);
    await userService.saveUser(user);
    res.json({ error: false });
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
    //TODO: Validate mint url
    const { mint_url } = req.body;
    let user = await userService.getUserByPubkey(authData.data.pubkey);
    if (!user) {
      user = userService.createNewUser(authData.data.pubkey);
    }
    user.setPreferredMint(mint_url);
    await userService.saveUser(user);
    res.json({ error: false });
  } catch (e) {
    next(e);
  }
}
