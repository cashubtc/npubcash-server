export interface UserCofig {
  pubkey: string;
  name?: string;
  mintUrl: string;
  lockQuote: boolean;
}

export class User {
  pubkey: string;
  name?: string;
  mintUrl: string;
  //TODO: Make sure casing is consistent
  lockQuote: boolean;

  constructor(config: UserCofig) {
    this.pubkey = config.pubkey;
    this.mintUrl = config.mintUrl;
    this.name = config.name;
    this.lockQuote = config.lockQuote;
  }

  setQuoteLocking(shouldLock: boolean) {
    this.lockQuote = shouldLock;
  }

  setPreferredMint(mintUrl: string) {
    this.mintUrl = mintUrl;
  }
}

export class UserWithName extends User {
  name: string;

  constructor(config: UserCofig & { name: string }) {
    super(config);
    this.name = config.name;
  }
}
