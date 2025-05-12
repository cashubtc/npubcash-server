import { userService } from "@/config";
import { BadRequestError } from "@/errors";
import { NextFunction, Request, Response } from "express";

export async function updateUserSettingLock(
  req: Request<unknown, unknown, { lock_quotes: boolean }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const isAuth = req.authData!;
    const { lock_quotes } = req.body;
    if (!lock_quotes) {
      throw new BadRequestError("Missing parameters");
    }
    await userService.setShouldLockQuote(isAuth.data.pubkey, lock_quotes);
    res.json({ error: false });
  } catch (e) {
    next(e);
  }
}
