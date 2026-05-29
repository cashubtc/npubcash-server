import { decode } from "light-bolt11-decoder";

type InvoiceData = {
  // FIX: parseInvoice returns amount: string
  amount: number;
  paymentHash: string;
  expiresIn: number;
  memo?: string;
};

export function parseInvoice(invoice: string): InvoiceData {
  const sections = decode(invoice).sections;
  const invoiceData: InvoiceData = { expiresIn: 3600 } as InvoiceData;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].name === "amount") {
      invoiceData.amount = sections[i].value;
    }
    if (sections[i].name === "expiry") {
      invoiceData.expiresIn = parseInt(sections[i].value);
    }
    if (sections[i].name === "description") {
      invoiceData.memo = sections[i].value;
    }
    if (sections[i].name === "payment_hash") {
      invoiceData.paymentHash = sections[i].value;
    }
  }
  return invoiceData;
}
