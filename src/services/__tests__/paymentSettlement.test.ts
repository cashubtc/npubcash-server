import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentSettlementService } from "../paymentSettlement";

const walletMock = vi.hoisted(() => ({
  on: {
    onceMintPaid: vi.fn(),
  },
  checkMintQuoteBolt11: vi.fn(),
  mintProofsBolt11: vi.fn(),
}));

const transactionModelMock = vi.hoisted(() => ({
  getTransactionByQuoteId: vi.fn(),
  getUnfulfilledCashuTransactions: vi.fn(),
  setToFulfilled: vi.fn(),
}));

const claimModelMock = vi.hoisted(() => ({
  createClaims: vi.fn(),
}));

const serviceRevenueClaimMock = vi.hoisted(() => ({
  getClaimsByQuoteId: vi.fn(),
  createClaims: vi.fn(),
}));

vi.mock("../../config", () => ({
  wallet: walletMock,
}));

vi.mock("../../models", () => ({
  Transaction: transactionModelMock,
  Claim: claimModelMock,
  ServiceRevenueClaim: serviceRevenueClaimMock,
}));

vi.mock("../../utils/analytics", () => ({
  Analyzer: {
    getInstance: vi.fn(() => ({
      logPaymentSettled: vi.fn(),
    })),
  },
}));

vi.mock("../../utils/nostr", () => ({
  createZapReceipt: vi.fn(),
  extractZapRequestData: vi.fn(),
  publishZapReceipt: vi.fn(),
}));

function transaction(overrides = {}) {
  return {
    id: 1,
    cashu_quote_id: "quote-id",
    amount: 21,
    user: "testUser",
    fulfilled: false,
    zap_request: undefined,
    server_pr: "invoice",
    recordFailedPayment: vi.fn(),
    ...overrides,
  };
}

describe("PaymentSettlementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MINTURL", "https://mint.example");
  });

  it("settles a websocket paid event by minting proofs and fulfilling once", async () => {
    const tx = transaction();
    const proofs = [{ id: "keyset", amount: 21, secret: "s", C: "c" }];
    walletMock.on.onceMintPaid.mockResolvedValue({
      quote: "quote-id",
      request: "invoice",
      state: "PAID",
    });
    transactionModelMock.getTransactionByQuoteId.mockResolvedValue(tx);
    walletMock.mintProofsBolt11.mockResolvedValue(proofs);

    await PaymentSettlementService.getInstance().watchTransaction(tx as any);

    expect(walletMock.on.onceMintPaid).toHaveBeenCalledWith("quote-id", {
      timeoutMs: 60_000,
    });
    expect(walletMock.mintProofsBolt11).toHaveBeenCalledWith(21, "quote-id");
    expect(claimModelMock.createClaims).toHaveBeenCalledWith(
      "testUser",
      "https://mint.example",
      proofs,
      1,
    );
    expect(transactionModelMock.setToFulfilled).toHaveBeenCalledWith(1);
  });

  it("does not mint twice for duplicate concurrent paid events", async () => {
    const tx = transaction();
    let releaseMint: (proofs: unknown[]) => void = () => {};
    transactionModelMock.getTransactionByQuoteId.mockResolvedValue(tx);
    walletMock.mintProofsBolt11.mockReturnValue(
      new Promise((resolve) => {
        releaseMint = resolve;
      }),
    );

    const first = PaymentSettlementService.getInstance().settleTransactionQuote(
      "quote-id",
      { quote: "quote-id", state: "PAID" } as any,
    );
    const second =
      PaymentSettlementService.getInstance().settleTransactionQuote(
        "quote-id",
        { quote: "quote-id", state: "PAID" } as any,
      );
    releaseMint([{ id: "keyset", amount: 21, secret: "s", C: "c" }]);
    await Promise.all([first, second]);

    expect(walletMock.mintProofsBolt11).toHaveBeenCalledTimes(1);
    expect(claimModelMock.createClaims).toHaveBeenCalledTimes(1);
  });

  it("falls back to polling when websocket watching fails", async () => {
    const tx = transaction();
    walletMock.on.onceMintPaid.mockRejectedValue(new Error("ws unsupported"));
    walletMock.checkMintQuoteBolt11.mockResolvedValue({
      quote: "quote-id",
      state: "PAID",
    });
    transactionModelMock.getTransactionByQuoteId.mockResolvedValue(tx);
    walletMock.mintProofsBolt11.mockResolvedValue([
      { id: "keyset", amount: 21, secret: "s", C: "c" },
    ]);

    await PaymentSettlementService.getInstance().watchTransaction(tx as any);

    expect(walletMock.checkMintQuoteBolt11).toHaveBeenCalledWith("quote-id");
    expect(transactionModelMock.setToFulfilled).toHaveBeenCalledWith(1);
  });

  it("polling ignores unpaid quotes and settles paid quotes", async () => {
    const tx = transaction();
    walletMock.checkMintQuoteBolt11
      .mockResolvedValueOnce({ quote: "quote-id", state: "UNPAID" })
      .mockResolvedValueOnce({ quote: "quote-id", state: "PAID" });
    transactionModelMock.getTransactionByQuoteId.mockResolvedValue(tx);
    walletMock.mintProofsBolt11.mockResolvedValue([
      { id: "keyset", amount: 21, secret: "s", C: "c" },
    ]);

    await PaymentSettlementService.getInstance().pollTransactionQuote(
      "quote-id",
      0,
      2,
    );

    expect(walletMock.mintProofsBolt11).toHaveBeenCalledTimes(1);
    expect(transactionModelMock.setToFulfilled).toHaveBeenCalledWith(1);
  });

  it("records failed payment state when minting fails", async () => {
    const tx = transaction();
    transactionModelMock.getTransactionByQuoteId.mockResolvedValue(tx);
    walletMock.mintProofsBolt11.mockRejectedValue(new Error("mint failed"));

    await expect(
      PaymentSettlementService.getInstance().settleTransactionQuote(
        "quote-id",
        { quote: "quote-id", state: "PAID" } as any,
      ),
    ).rejects.toThrow("mint failed");

    expect(tx.recordFailedPayment).toHaveBeenCalled();
    expect(transactionModelMock.setToFulfilled).not.toHaveBeenCalled();
  });

  it("mints and stores service revenue proofs for a paid username quote", async () => {
    const proofs = [{ id: "keyset", amount: 10, secret: "s", C: "c" }];
    serviceRevenueClaimMock.getClaimsByQuoteId.mockResolvedValue([]);
    walletMock.checkMintQuoteBolt11.mockResolvedValue({
      quote: "quote-id",
      state: "PAID",
    });
    walletMock.mintProofsBolt11.mockResolvedValue(proofs);

    const paid =
      await PaymentSettlementService.getInstance().settleServiceRevenueQuote(
        "quote-id",
        "invoice",
        10,
      );

    expect(paid).toBe(true);
    expect(serviceRevenueClaimMock.createClaims).toHaveBeenCalledWith(
      "quote-id",
      "invoice",
      10,
      proofs,
    );
  });
});
