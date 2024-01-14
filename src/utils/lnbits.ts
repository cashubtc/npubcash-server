import { LNBitsInvoiceData, LNBitsInvoiceResponse } from "../types";
import { checkEnvVars } from "./general";

export async function getInvoice(
  amountInSats: number,
  memo?: string,
  webhook?: string,
  descHash?: string,
  unhashedDesc?: string,
): Promise<LNBitsInvoiceResponse> {
  checkEnvVars(["LNBITS_INVOICE"]);

  const invoiceBody = {
    out: false,
    amount: amountInSats,
    memo: memo ? memo : "",
  } as LNBitsInvoiceData;

  if (webhook) {
    invoiceBody.webhook = webhook;
  }
  if (descHash) {
    invoiceBody.description_hash = descHash;
  }
  if (unhashedDesc) {
    invoiceBody.unhashed_description = unhashedDesc;
  }
  const invoiceRes = await fetch("https://legend.lnbits.com/api/v1/payments", {
    method: "POST",
    body: JSON.stringify(invoiceBody),
    headers: {
      "Content-type": "application/json",
      "X-Api-Key": process.env["LNBITS_INVOICE"]!,
    },
  });
  const invoiceResData = await invoiceRes.json();
  return invoiceResData;
}

export async function payInvoice(invoice: string) {
  checkEnvVars(["LNBITS_ADMIN"]);
  const payRes = await fetch("https://legen.lnbits.com/api/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      out: true,
      bolt11: invoice,
    }),
    headers: {
      "Content-type": "application/json",
      "X-Api-Key": process.env["LNBITS_ADMIN"]!,
    },
  });
  const payData = await payRes.json();
  console.log(payData);
  return payData;
}
