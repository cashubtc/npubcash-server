import type { Logger } from "winston";
import type {
  RealTimeTransport,
  TransportEvent,
  WsRequest,
  WsResponse,
  WsNotification,
  SubscribeParams,
  MintAdapter,
  PollingOptions,
  MintQuotePayload,
} from "./types";

interface Task {
  subId: string;
  filter: string; // quoteId
}

interface MintScheduler {
  nextAllowedAt: number;
  queue: Task[];
  running: boolean;
}

export class PollingTransport implements RealTimeTransport {
  private readonly logger?: Logger;
  private readonly mintAdapter: MintAdapter;
  private readonly options: Required<PollingOptions>;
  private readonly listenersByMint = new Map<
    string,
    Map<TransportEvent, Set<(event: any) => void>>
  >();
  private readonly schedByMint = new Map<string, MintScheduler>();
  private readonly intervalByMint = new Map<string, number>();
  private readonly unsubscribedByMint = new Map<string, Set<string>>();
  private readonly hasEmittedOpenByMint = new Set<string>();

  constructor(
    mintAdapter: MintAdapter,
    options?: PollingOptions,
    logger?: Logger,
  ) {
    this.logger = logger;
    this.mintAdapter = mintAdapter;
    this.options = {
      intervalMs: options?.intervalMs ?? 5000,
    };
  }

  on(
    mintUrl: string,
    event: TransportEvent,
    handler: (evt: any) => void,
  ): void {
    let map = this.listenersByMint.get(mintUrl);
    if (!map) {
      map = new Map();
      this.listenersByMint.set(mintUrl, map);
    }
    let set = map.get(event);
    if (!set) {
      set = new Set();
      map.set(event, set);
    }
    if (!set.has(handler)) set.add(handler);

    // Emit synthetic open once per mint
    if (event === "open" && !this.hasEmittedOpenByMint.has(mintUrl)) {
      this.hasEmittedOpenByMint.add(mintUrl);
      queueMicrotask(() => {
        try {
          handler({ type: "open" });
        } catch {}
      });
    }

    this.ensureScheduler(mintUrl);
  }

  send(mintUrl: string, req: WsRequest): void {
    if (req.method === "subscribe") {
      const params = req.params as SubscribeParams;
      const subId = params.subId;
      const scheduler = this.ensureScheduler(mintUrl);

      const filter = params.filters[0];
      if (!filter) {
        this.logger?.error("[Polling] Subscribe with no filter", {
          transport: "polling",
          mintUrl,
          req,
        });
        return;
      }

      scheduler.queue.push({ subId, filter });

      // Acknowledge subscribe immediately
      const resp: WsResponse = {
        jsonrpc: "2.0",
        result: { status: "OK", subId },
        id: req.id,
      };
      this.emit(mintUrl, "message", { data: JSON.stringify(resp) });

      void this.maybeRun(mintUrl);
      return;
    }

    if (req.method === "unsubscribe") {
      const subId = (req.params as any).subId as string;
      const scheduler = this.ensureScheduler(mintUrl);
      scheduler.queue = scheduler.queue.filter((t) => t.subId !== subId);

      let unsubscribed = this.unsubscribedByMint.get(mintUrl);
      if (!unsubscribed) {
        unsubscribed = new Set();
        this.unsubscribedByMint.set(mintUrl, unsubscribed);
      }
      unsubscribed.add(subId);
    }
  }

  closeAll(): void {
    this.schedByMint.clear();
    this.listenersByMint.clear();
    this.intervalByMint.clear();
    this.unsubscribedByMint.clear();
    this.hasEmittedOpenByMint.clear();
  }

  closeMint(mintUrl: string): void {
    this.schedByMint.delete(mintUrl);
    this.listenersByMint.delete(mintUrl);
    this.intervalByMint.delete(mintUrl);
    this.unsubscribedByMint.delete(mintUrl);
    this.hasEmittedOpenByMint.delete(mintUrl);
  }

  setIntervalForMint(mintUrl: string, intervalMs: number): void {
    this.intervalByMint.set(mintUrl, intervalMs);
    this.logger?.debug("[Polling] Interval updated", { transport: "polling", mintUrl, intervalMs });
  }

  private getIntervalForMint(mintUrl: string): number {
    return this.intervalByMint.get(mintUrl) ?? this.options.intervalMs;
  }

  private ensureScheduler(mintUrl: string): MintScheduler {
    let s = this.schedByMint.get(mintUrl);
    if (!s) {
      s = { nextAllowedAt: 0, queue: [], running: false };
      this.schedByMint.set(mintUrl, s);
    }
    return s;
  }

  private async maybeRun(mintUrl: string): Promise<void> {
    const s = this.ensureScheduler(mintUrl);
    if (s.running) return;
    const now = Date.now();
    if (now < s.nextAllowedAt) return;
    if (s.queue.length === 0) return;

    s.running = true;
    const task = s.queue.shift()!;

    try {
      await this.performTask(mintUrl, task);

      const unsubscribed = this.unsubscribedByMint.get(mintUrl);
      const wasUnsubscribed = unsubscribed?.has(task.subId);

      if (wasUnsubscribed) {
        unsubscribed!.delete(task.subId);
      } else {
        s.queue.push(task);
      }
    } catch (err) {
      this.logger?.error("[Polling] Task error", { transport: "polling", mintUrl, err });
      // Re-enqueue task on error
      s.queue.push(task);
    } finally {
      s.nextAllowedAt = Date.now() + this.getIntervalForMint(mintUrl);
      s.running = false;

      const delay = Math.max(0, s.nextAllowedAt - Date.now());
      setTimeout(() => {
        void this.maybeRun(mintUrl);
      }, delay);
    }
  }

  private async performTask(mintUrl: string, task: Task): Promise<void> {
    const payload: MintQuotePayload = await this.mintAdapter.checkMintQuoteState(
      mintUrl,
      task.filter,
    );

    const notification: WsNotification<MintQuotePayload> = {
      jsonrpc: "2.0",
      method: "subscribe",
      params: { subId: task.subId, payload },
    };
    this.emit(mintUrl, "message", { data: JSON.stringify(notification) });
  }

  private emit(mintUrl: string, event: TransportEvent, evt: any): void {
    const map = this.listenersByMint.get(mintUrl);
    const set = map?.get(event);
    if (!set) return;
    for (const handler of set.values()) {
      try {
        handler(evt);
      } catch {}
    }
  }
}
