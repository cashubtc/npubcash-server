import { gql, GraphQLClient } from "graphql-request";
import { BlinkInvoiceResponse, BlinkPaymentResponse } from "../types";

const endpoint = `${process.env.BLINK_URL!}`;

const graphQLClient = new GraphQLClient(endpoint, {
  headers: {
    "X-API-KEY": process.env.BLINK_API_KEY!,
    "Content-Type": "application/json",
  },
});

export async function sendPayment(invoice: string) {
  const mutation = gql`
    mutation lnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
      lnInvoicePaymentSend(input: $input) {
        status
        errors {
          message
          path
          code
        }
      }
    }
  `;
  const variables = {
    input: {
      walletId: process.env.BLINK_WALLET_ID,
      paymentRequest: invoice,
    },
  };
  const data = (await graphQLClient.request(
    mutation,
    variables,
  )) as BlinkPaymentResponse;
  if (data.lnInvoicePaymentSend.status !== "SUCCESS") {
    throw new Error("Wallet returned an error");
  }
  return data.lnInvoicePaymentSend.status;
}

export async function createInvoice(amountInSats: number, memo: string) {
  const mutation = gql`
    mutation LnInvoiceCreateOnBehalfOfRecipient(
      $input: LnInvoiceCreateOnBehalfOfRecipientInput!
    ) {
      lnInvoiceCreateOnBehalfOfRecipient(input: $input) {
        invoice {
          paymentRequest
          paymentHash
          paymentSecret
          satoshis
        }
        errors {
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      amount: amountInSats,
      memo,
      recipientWalletId: process.env.BLINK_WALLET_ID,
    },
  };

  const data = (await graphQLClient.request(
    mutation,
    variables,
  )) as BlinkInvoiceResponse;

  if (!data.lnInvoiceCreateOnBehalfOfRecipient.invoice) {
    throw new Error("Failed to retrieve invoice");
  }
  return data.lnInvoiceCreateOnBehalfOfRecipient.invoice;
}
