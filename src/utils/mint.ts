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
