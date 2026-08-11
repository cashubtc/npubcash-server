import { Request, Response } from "express";
import { getUserService } from "@/config";

export async function nip05Controller(
  req: Request<unknown, unknown, unknown, { name: string }>,
  res: Response,
) {
  const { name } = req.query;
  if (!name) {
    return res.json({ names: {}, relays: {} });
  }
  try {
    const userService = getUserService();
    const user = await userService.getUserByName(name);
    if (!user) {
      return res.json({ names: {}, relays: {} });
    }
    return res.json({ names: { [user.name]: user.pubkey }, relays: {} });
  } catch {
    res.json({ error: true, message: "Failed to check nostr.json" });
  }
}
