import type {
  MintQuote,
  MintQuoteState,
} from "@/domain/mintQuote/MintQuote";
import type {
  MintQuoteMonitoringStore,
  MintQuoteStateTransition,
} from "./MintQuoteMonitoringStore";
import type {
  QuoteObservation,
  QuoteStateChange,
} from "./QuoteObservation";

interface QuoteStateChangeEmitter {
  emit(event: "mintQuote.stateChanged", change: QuoteStateChange): void;
}

interface QuoteObservationHandlerOptions {
  store: MintQuoteMonitoringStore;
  events: QuoteStateChangeEmitter;
  now?: () => Date;
}

export interface QuoteObservationHandler {
  handle(
    observation: QuoteObservation,
  ): Promise<QuoteStateChange | undefined>;
}

export class DefaultQuoteObservationHandler
  implements QuoteObservationHandler
{
  private readonly store: MintQuoteMonitoringStore;
  private readonly events: QuoteStateChangeEmitter;
  private readonly now: () => Date;

  constructor(options: QuoteObservationHandlerOptions) {
    this.store = options.store;
    this.events = options.events;
    this.now = options.now ?? (() => new Date());
  }

  async handle(
    observation: QuoteObservation,
  ): Promise<QuoteStateChange | undefined> {
    const quote = await this.store.getById(observation.mintQuoteId);
    if (!quote) return undefined;

    const transition = this.toTransition(quote, observation);
    if (!transition) return undefined;

    const updated = await this.store.transitionState(transition);
    if (!updated) return undefined;

    const change: QuoteStateChange = {
      quote: updated,
      source: observation.source,
    };
    this.events.emit("mintQuote.stateChanged", change);
    return change;
  }

  private toTransition(
    quote: MintQuote,
    observation: QuoteObservation,
  ): MintQuoteStateTransition | undefined {
    if (
      observation.source === "polling" &&
      observation.result.kind === "not_found"
    ) {
      return this.transition(quote.id, ["UNPAID"], "EXPIRED");
    }

    const payload =
      observation.source === "websocket"
        ? observation.payload
        : observation.result.kind === "found"
          ? observation.result.payload
          : undefined;
    if (!payload) return undefined;
    if (payload.quote !== quote.quoteId) return undefined;

    if (payload.state === "PAID") {
      return this.transition(
        quote.id,
        ["UNPAID", "EXPIRED"],
        "PAID",
        this.now(),
      );
    }

    if (payload.state === "ISSUED") {
      return this.transition(
        quote.id,
        ["UNPAID", "EXPIRED", "PAID"],
        "ISSUED",
        this.now(),
      );
    }

    if (
      observation.source === "polling" &&
      payload.state === "UNPAID" &&
      observation.requestStartedAt.getTime() >= quote.expiresAt.getTime()
    ) {
      return this.transition(quote.id, ["UNPAID"], "EXPIRED");
    }

    return undefined;
  }

  private transition(
    id: number,
    from: readonly MintQuoteState[],
    to: MintQuoteStateTransition["to"],
    paidAt?: Date,
  ): MintQuoteStateTransition {
    return { id, from, to, paidAt };
  }
}
