export type MintData = {
  mintPr: string;
  mintHash: string;
  user: string;
};

export type LNBitsInvoiceData = {
  out: boolean;
  amount: number;
  memo?: string;
  webhook?: string;
  description_hash?: string;
  unhashed_description?: string;
};

export type LNBitsInvoiceResponse = {
  payment_hash: string;
  payment_request: string;
  checking_id: string;
  lnurl_response?: string;
};

export type BlinkInvoiceResponse = {
  lnInvoiceCreateOnBehalfOfRecipient: {
    invoice: {
      paymentRequest: string;
      paymentHash: string;
      paymentSecret: string;
      satoshis: number;
    };
  };
};

export type BlinkPaymentResponse = {
  lnInvoicePaymentSend: {
    status: string;
  };
};
