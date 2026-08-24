import { SimplePool } from "nostr-tools";
import { UserService } from "./domain/user/UserService";
import { CommunicatorService } from "./domain/communicator/CommunicatorService";
import { ProofService } from "./domain/proof/proofService";
import { MintService } from "./domain/mint/MintService";
import { QuoteSubscriptionManager } from "./websocket/subs";
import { eventBus } from "./events";
import { Repositories } from "./infrastructure/db/repositoryFactory";
import { UserRepository } from "./domain/user/userRepository";
import { MintQuoteRepository } from "./domain/mintQuote/MintQuoteRepository";
import { FetchMintQuoteClient } from "./domain/mintQuoteMonitor/MintQuoteClient";
import { PerMintRequestBudget } from "./infrastructure/MintRequestBudget";
import { BudgetedMintRequestExecutor } from "./infrastructure/MintRequestExecutor";
import { FetchMintInfoLoader } from "./infrastructure/FetchMintInfoLoader";
import { DefaultQuoteObservationHandler } from "./domain/mintQuoteMonitoring/QuoteObservationHandler";
import {
  DefaultQuotePollingService,
  type QuotePollingService,
} from "./domain/mintQuoteMonitoring/QuotePollingService";
import {
  DefaultQuoteWebSocketService,
  type QuoteWebSocketService,
} from "./domain/mintQuoteMonitoring/QuoteWebSocketService";
import { config } from "./config/index";
import { logger } from "./utils/logger";
import { handleZapRequest } from "./utils/nostr";
import { decodeZapRequestParameter } from "./utils/zapRequest";
import {
  createRecipientBlocks,
  RecipientBlocks,
} from "./domain/recipientBlock/RecipientBlocks";

interface AppServices {
  userRepository: UserRepository;
  mintQuoteRepository: MintQuoteRepository;
  userService: UserService;
  communicatorService: CommunicatorService;
  proofService: ProofService;
  mintService: MintService;
  recipientBlocks: RecipientBlocks;
  quotePollingService: QuotePollingService;
  quoteWebSocketService: QuoteWebSocketService;
}

let appServices: AppServices | null = null;

export const nostrPool = new SimplePool();

export async function initializeAppServices(
  repos: Repositories,
): Promise<AppServices> {
  const mintRequestBudget = new PerMintRequestBudget(
    config.mintQuoteMonitor.requestRateLimit,
  );
  const mintRequestExecutor = new BudgetedMintRequestExecutor({
    requestBudget: mintRequestBudget,
    timeoutMs: config.mintQuoteMonitor.requestTimeoutMs,
  });
  const mintService = new MintService(repos.mintRepository, {
    mintInfoLoader: new FetchMintInfoLoader({
      requestExecutor: mintRequestExecutor,
    }),
  });
  const quoteObservationHandler = new DefaultQuoteObservationHandler({
    store: repos.mintQuoteMonitoringStore,
    events: eventBus,
  });
  const quoteWebSocketService = new DefaultQuoteWebSocketService({
    store: repos.mintQuoteMonitoringStore,
    handler: quoteObservationHandler,
    transportOptions: {
      logger,
      periodicReconnectMs: config.mintQuoteMonitor.periodicReconnectMs,
      requestBudget: mintRequestBudget,
    },
    events: eventBus,
    logger,
  });
  const quotePollingService = new DefaultQuotePollingService({
    store: repos.mintQuoteMonitoringStore,
    batchingSupport: mintService,
    client: new FetchMintQuoteClient({
      requestExecutor: mintRequestExecutor,
    }),
    handler: quoteObservationHandler,
    pollIntervalMs: config.mintQuoteMonitor.activePollIntervalMs,
    logger,
  });
  const recipientBlocks = await createRecipientBlocks(
    repos.recipientBlockRepository,
  );
  appServices = {
    userRepository: repos.userRepository,
    mintQuoteRepository: repos.mintQuoteRepository,
    userService: new UserService(repos.userRepository),
    communicatorService: new CommunicatorService(),
    proofService: new ProofService(repos.proofRepository),
    mintService,
    recipientBlocks,
    quotePollingService,
    quoteWebSocketService,
  };
  return appServices;
}

function getAppServices(): AppServices {
  if (!appServices) {
    throw new Error("App services not initialized. Call setupDatabase() first.");
  }
  return appServices;
}

export function getUserRepository(): UserRepository {
  return getAppServices().userRepository;
}

export function getMintQuoteRepository(): MintQuoteRepository {
  return getAppServices().mintQuoteRepository;
}

export function getUserService(): UserService {
  return getAppServices().userService;
}

export function getCommunicatorService(): CommunicatorService {
  return getAppServices().communicatorService;
}

export function getProofService(): ProofService {
  return getAppServices().proofService;
}

export function getMintService(): MintService {
  return getAppServices().mintService;
}

export function getRecipientBlocks(): RecipientBlocks {
  return getAppServices().recipientBlocks;
}

export async function startMintQuoteMonitoring(): Promise<void> {
  const services = getAppServices();
  await services.quoteWebSocketService.start();
  try {
    await services.quotePollingService.start();
  } catch (cause) {
    await services.quoteWebSocketService.stop();
    throw cause;
  }
}

export async function stopMintQuoteMonitoring(): Promise<void> {
  const services = getAppServices();
  try {
    await services.quotePollingService.stop();
  } finally {
    await services.quoteWebSocketService.stop();
  }
}

export const subManager = new QuoteSubscriptionManager();
eventBus.on("mintQuote.stateChanged", ({ quote }) => {
  if (quote.state !== "PAID") return;
  subManager.update(quote.pubkey, quote);
});

eventBus.on("mintQuote.stateChanged", async ({ quote }) => {
  if (
    quote.state !== "PAID" ||
    !quote.serializedZapRequest ||
    !config.nostr.nostrEnabled
  ) {
    return;
  }
  try {
    const zapRequest = decodeZapRequestParameter(quote.serializedZapRequest);
    await handleZapRequest(
      quote.quoteId,
      zapRequest,
      quote.paymentRequest,
      logger,
    );
  } catch (cause) {
    logger.error("[QuoteObservationHandler] Failed to handle zap request", {
      quoteId: quote.quoteId,
      cause,
    });
  }
});
