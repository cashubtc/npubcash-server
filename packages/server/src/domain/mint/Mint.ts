import { MintInfo } from "@cashu/cashu-ts";

export class Mint {
  lastChecked: Date;
  url: string;
    info: MintInfo;

  constructor(config: {
    url: string;
  info: MintInfo;
    lastChecked: Date;
  }) {
    this.url = config.url;
    this.info = config.info;
    this.lastChecked = config.lastChecked;
  }

  infoExpired() {
    return this.lastChecked.getTime() + 3600 * 1000 < Date.now();
  }

  updateInfo(info: MintInfo) {
    this.info = info;
    this.lastChecked = new Date();
  }

  get mintConfig() {
    const nut04 = this.info.nuts[4];
    if (nut04.disabled) {
      return { enabled: false };
    }
    const bolt11Entry = nut04.methods.find((e) => e.method === "bolt11");
    if (!bolt11Entry) {
      return { enabled: false };
    }
    return {
      enabled: true,
      min: bolt11Entry.min_amount,
      max: bolt11Entry.max_amount,
    };
  }

  supportsLocking() {
    return this.info.nuts[20] && this.info.nuts[20].supported;
  }
}
