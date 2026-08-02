import { beforeEach, describe, expect, it, vi } from "vitest";
import { paidController } from "../paidController";

const mocks = vi.hoisted(() => ({
  createClaims: vi.fn(),
  getTransactionByHash: vi.fn(),
  logPaymentSettled: vi.fn(),
  mintTokens: vi.fn(),
  payInvoice: vi.fn(),
  setToFulfilled: vi.fn(),
}));

vi.mock("../../config", () => ({
  lnProvider: { payInvoice: mocks.payInvoice },
  wallet: { mintTokens: mocks.mintTokens },
}));

vi.mock("../../models", () => ({
  Claim: { createClaims: mocks.createClaims },
  Transaction: {
    getTransactionByHash: mocks.getTransactionByHash,
    setToFulfilled: mocks.setToFulfilled,
  },
}));

vi.mock("../../utils/analytics", () => ({
  Analyzer: {
    getInstance: () => ({ logPaymentSettled: mocks.logPaymentSettled }),
  },
}));

vi.mock("../../utils/nostr", () => ({
  createZapReceipt: vi.fn(),
  extractZapRequestData: vi.fn(),
  publishZapReceipt: vi.fn(),
}));

describe("paidController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MINTURL", "https://mint.example");
  });

  it("mints the settled amount with the stored quote and persists its proofs", async () => {
    const transaction = {
      id: 42,
      mint_pr: "mint-invoice",
      mint_hash: "mint-quote",
      user: "npub1recipient",
      zap_request: undefined,
      recordFailedPayment: vi.fn(),
    };
    const proofs = [
      { amount: 21, id: "keyset-id", secret: "secret", C: "signature" },
    ];
    mocks.getTransactionByHash.mockResolvedValue(transaction);
    mocks.mintTokens.mockResolvedValue({ proofs });
    const sendStatus = vi.fn();

    await paidController(
      {
        body: {
          eventType: "receive.lightning",
          transaction: {
            memo: "payment",
            settlementAmount: 21,
            initiationVia: { paymentHash: "server-payment-hash" },
          },
        },
      } as never,
      { sendStatus } as never,
    );

    expect(mocks.mintTokens).toHaveBeenCalledWith(21, "mint-quote");
    expect(mocks.createClaims).toHaveBeenCalledWith(
      "npub1recipient",
      "https://mint.example",
      proofs,
      42,
    );
    expect(mocks.setToFulfilled).toHaveBeenCalledWith(42);
    expect(sendStatus).toHaveBeenCalledWith(200);
  });
});
