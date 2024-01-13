export async function getInvoice(amountInSats: number, webhook?: string) {
  const invoiceRes = await fetch("https://legend.lnbits.com/api/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      out: false,
      amount: amountInSats,
      memo: "12345",
      webhook: webhook ? webhook : "",
    }),
    headers: {
      "Content-type": "application/json",
      "X-Api-Key": "d3163cf0fc0c455a931a2adab8593648",
    },
  });
  const invoiceData = await invoiceRes.json();
  return invoiceData;
}

export async function payInvoice(invoice: string) {
  const payRes = await fetch("https://legen.lnbits.com/api/v1/payments", {
    method: "POST",
    body: JSON.stringify({
      out: true,
      bolt11: invoice,
    }),
    headers: {
      "Content-type": "application/json",
      "X-Api-Key": "1560d4f2737d4a7da027185ac8d9af9d",
    },
  });
  const payData = await payRes.json();
  console.log(payData);
  return payData;
}
