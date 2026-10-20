import {
  ApiError,
  NPCClient,
  PaymentRequiredError,
} from "npubcash-sdk";

export async function loadQuotes(client: NPCClient) {
  try {
    return await client.getAllQuotes();
  } catch (error) {
    if (error instanceof PaymentRequiredError) {
      console.error("Cashu payment required", error.paymentRequest);
    } else if (error instanceof ApiError) {
      console.error(
        `npubcash request failed (${error.statusCode})`,
        error.message,
      );
    }
    throw error;
  }
}
