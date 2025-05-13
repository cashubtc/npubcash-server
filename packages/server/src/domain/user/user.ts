export interface UserCofig {
  pubkey: string;
  name?: string;
  mintUrl: string;
  lock_quote: boolean;
}

export class User {
  pubkey: string;
  name?: string;
  mintUrl: string;
  lock_quote: boolean;

  constructor(config: UserCofig) {
    this.pubkey = config.pubkey;
    this.mintUrl = config.mintUrl;
    this.name = config.name;
    this.lock_quote = config.lock_quote;
  }

  setQuoteLocking(shouldLock: boolean) {
    this.lock_quote = shouldLock;
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
