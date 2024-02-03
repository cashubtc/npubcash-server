import { decode } from "light-bolt11-decoder";
import { PaymentProvider } from "../types";

type InvoiceData = {
  amount: number;
  paymentHash: string;
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
    if (sections[i].name === "payment_hash") {
      invoiceData.paymentHash = sections[i].value;
    }
  }
  return invoiceData;
}

export class LightningHandler {
  provider: PaymentProvider;
  constructor(provider: PaymentProvider) {
    this.provider = provider;
  }
  async createInvoice(amount: number, memo?: string, descriptionHash?: string) {
    return this.provider.createInvoice(amount, memo, descriptionHash);
  }
  async payInvoice(invoice: string) {
    return this.provider.payInvoice(invoice);
  }
  async checkPayment(invoice: string) {
    return this.provider.checkPayment(invoice);
  }
}
