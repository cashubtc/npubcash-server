import { CashuMint, CashuWallet } from "@cashu/cashu-ts";

export const cashuWalletMap: { [mintUrl: string]: CashuWallet } = {};

export function getWalletFromCache(mintUrl: string) {
  if (cashuWalletMap[mintUrl]) {
    return cashuWalletMap[mintUrl];
  }
  const newWallet = new CashuWallet(new CashuMint(mintUrl));
  cashuWalletMap[mintUrl] = newWallet;
  return newWallet;
}

export function clearWalletCache() {
  const keys = Object.keys(cashuWalletMap);
  keys.forEach((k) => {
    delete cashuWalletMap[k];
  });
}

export async function isValidMint(url: string) {
  try {
    new URL(url);
    const res = await fetch(`${url}/v1/info`);
    const data = await res.json();
    if (!data.pubkey) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}
