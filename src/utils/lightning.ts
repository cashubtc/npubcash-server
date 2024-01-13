import { decode } from "light-bolt11-decoder";

type InvoiceData = {
  amount: number;
  memo?: string;
};

export function parseInvoice(invoice: string): InvoiceData {
  const sections = decode(invoice).sections;
  const invoiceData: InvoiceData = {} as InvoiceData;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].name === "amount") {
      invoiceData.amount = sections[i].value;
    }
    if (sections[i].name === "description") {
      invoiceData.memo = sections[i].value;
    }
  }
  return invoiceData;
}
