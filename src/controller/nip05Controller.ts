import { Request, Response } from "express";
import { User } from "../models";

export async function nip05Controller(
  req: Request<unknown, unknown, unknown, { name: string }>,
  res: Response,
) {
  const { name } = req.query;
  if (!name) {
    return res.json({ names: {}, relays: {} });
  }
  try {
    const user = await User.getUserByName(name);
    if (!user) {
      return res.json({ names: {}, relays: {} });
    }
    return res.json({ names: { [user.name]: user.pubkey }, relays: {} });
  } catch {
    res.json({ error: true, message: "Failed to check nostr.json" });
  }
}
