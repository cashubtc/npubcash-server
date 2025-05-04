export interface UserCofig {
  pubkey: string;
  name?: string;
  mintUrl: string;
}

export class User {
  pubkey: string;
  name?: string;
  mintUrl: string;

  constructor(config: UserCofig) {
    this.pubkey = config.pubkey;
    this.mintUrl = config.mintUrl;
    this.name = config.name;
  }
}
