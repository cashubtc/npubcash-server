import {
  ConsoleLogger,
  JWTAuthProvider,
  NPCClient,
  type SigningFunc,
} from "npubcash-sdk";

// Supply this function from your Nostr extension, signer library, or key store.
declare const signer: SigningFunc;

const baseUrl = "https://npub.cash";
const auth = new JWTAuthProvider(baseUrl, signer);
const client = new NPCClient(baseUrl, auth);

client.setLogger(new ConsoleLogger());

const user = await client.getInfo();
const quotes = await client.getAllQuotes();

console.log("Mint:", user.mintUrl);
console.log("Paid quotes:", quotes);

const unsubscribe = client.subscribe(
  (quoteId) => console.log("Quote updated:", quoteId),
  (message) => console.error("Subscription error:", message),
);

// Call this when the subscription is no longer needed.
unsubscribe();
