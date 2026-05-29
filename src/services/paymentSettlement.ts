import {
  MintQuoteBolt11Response,
  MintQuoteState,
} from "@cashu/cashu-ts";
import { wallet } from "../config";
import { Claim, ServiceRevenueClaim, Transaction } from "../models";
import {
  createZapReceipt,
  extractZapRequestData,
  publishZapReceipt,
} from "../utils/nostr";
import { Analyzer } from "../utils/analytics";

const DEFAULT_WS_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PaymentSettlementService {
  private static instance: PaymentSettlementService;
  private settlingQuotes = new Set<string>();

  static getInstance() {
    if (!PaymentSettlementService.instance) {
      PaymentSettlementService.instance = new PaymentSettlementService();
    }
    return PaymentSettlementService.instance;
  }

  async watchTransaction(transaction: Transaction) {
    let paidQuote: MintQuoteBolt11Response;
    try {
      paidQuote = await wallet.on.onceMintPaid(
        transaction.cashu_quote_id,
        { timeoutMs: DEFAULT_WS_TIMEOUT_MS },
      );
    } catch (e) {
      console.warn("Mint quote websocket failed; falling back to polling", e);
      return this.pollTransactionQuote(transaction.cashu_quote_id);
    }
    await this.settleTransactionQuote(transaction.cashu_quote_id, paidQuote);
  }

  startWatchingTransaction(transaction: Transaction) {
    void this.watchTransaction(transaction).catch((e) => {
      console.error("Background Cashu settlement watcher failed", e);
    });
  }

  async recoverUnfulfilledTransactions() {
    const transactions = await Transaction.getUnfulfilledCashuTransactions();
    transactions.forEach((transaction) => {
      this.startWatchingTransaction(transaction);
    });
  }

  async pollTransactionQuote(
    quoteId: string,
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
    maxAttempts = DEFAULT_MAX_POLL_ATTEMPTS,
  ) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const quote = await wallet.checkMintQuoteBolt11(quoteId);
      if (quote.state === MintQuoteState.PAID) {
        await this.settleTransactionQuote(quoteId, quote);
        return quote;
      }
      if (quote.state === MintQuoteState.ISSUED) {
        return quote;
      }
      if (attempt < maxAttempts - 1) {
        await sleep(intervalMs);
      }
    }
  }

  async settleTransactionQuote(
    quoteId: string,
    paidQuote?: MintQuoteBolt11Response,
  ) {
    if (this.settlingQuotes.has(quoteId)) {
      return;
    }
    this.settlingQuotes.add(quoteId);
    let transaction: Transaction | undefined;
    try {
      transaction = await Transaction.getTransactionByQuoteId(quoteId);
      if (transaction.fulfilled) {
        return;
      }
      const quote = paidQuote || (await wallet.checkMintQuoteBolt11(quoteId));
      if (quote.state !== MintQuoteState.PAID) {
        return;
      }
      Analyzer.getInstance().logPaymentSettled(quoteId);
      const proofs = await wallet.mintProofsBolt11(
        transaction.amount,
        quote.quote,
      );
      await Claim.createClaims(
        transaction.user,
        process.env.MINTURL!,
        proofs,
        transaction.id,
      );
      await this.publishZapReceipt(transaction);
      await Transaction.setToFulfilled(transaction.id);
    } catch (e) {
      if (transaction) {
        await transaction.recordFailedPayment();
      }
      console.error("Failed to settle Cashu mint quote", e);
      throw e;
    } finally {
      this.settlingQuotes.delete(quoteId);
    }
  }

  async settleServiceRevenueQuote(
    quoteId: string,
    paymentRequest: string,
    amount: number,
  ) {
    if (this.settlingQuotes.has(quoteId)) {
      return false;
    }
    this.settlingQuotes.add(quoteId);
    try {
      const existing = await ServiceRevenueClaim.getClaimsByQuoteId(quoteId);
      if (existing.length > 0) {
        return true;
      }
      const quote = await wallet.checkMintQuoteBolt11(quoteId);
      if (quote.state !== MintQuoteState.PAID) {
        return false;
      }
      const proofs = await wallet.mintProofsBolt11(amount, quote.quote);
      await ServiceRevenueClaim.createClaims(
        quoteId,
        paymentRequest,
        amount,
        proofs,
      );
      return true;
    } finally {
      this.settlingQuotes.delete(quoteId);
    }
  }

  private async publishZapReceipt(transaction: Transaction) {
    if (!transaction.zap_request || !process.env.ZAP_SECRET_KEY) {
      return;
    }
    try {
      const zapRequestData = extractZapRequestData(transaction.zap_request);
      const zapReceipt = createZapReceipt(
        Math.floor(Date.now() / 1000),
        zapRequestData.pTags[0],
        zapRequestData.eTags[0],
        zapRequestData.aTags[0],
        transaction.server_pr,
        transaction.zap_request,
      );
      const pubResults = await publishZapReceipt(
        zapReceipt,
        zapRequestData.relays.length > 0 ? zapRequestData.relays : undefined,
      );
      pubResults.forEach((p) => {
        if (p.status === "rejected") {
          console.warn("receipt publish failed: ", p.reason);
        } else {
          console.log("receipt published successfully! ", p.value);
        }
      });
    } catch (e) {
      console.log(e);
    }
  }
}
