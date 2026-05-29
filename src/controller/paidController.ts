import { Request, Response } from "express";

export async function paidController(
  req: Request<
    unknown,
    unknown,
    {
      eventType: string;
      transaction: {
        memo: string;
        settlementAmount: number;
        initiationVia: { paymentHash: string };
      };
    },
    unknown
  >,
  res: Response,
) {
  return res.sendStatus(200);
}
