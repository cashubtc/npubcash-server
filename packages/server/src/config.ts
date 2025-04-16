import { SimplePool, getPublicKey } from "nostr-tools";
import { CashuMint, CashuWallet } from "@cashu/cashu-ts";
import { LightningHandler } from "./utils/lightning";
import { BlinkProvider } from "./utils/blink";
import { MintCommunicator } from "almnd";

class Logger {
  log(m: string) {
    console.log("Mint Communicator: ", m);
  }
}

export const wallet = new CashuWallet(new CashuMint(process.env.MINTURL!));
export const lnProvider = new LightningHandler(new BlinkProvider());
export const nostrPool = new SimplePool();

export const mintComm = new MintCommunicator(process.env.MINTURL!, {
  initialPollingTimeout: { mint: 10000, melt: 10000, proof: 10000 },
  backoffFunction: (r) => Math.min(5000 * Math.pow(2, r), 600000),
  throttleCapacity: 10,
  throttleTimeout: 3500,
  logger: new Logger(),
});
