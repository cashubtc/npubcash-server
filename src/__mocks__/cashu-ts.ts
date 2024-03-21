class CashuMint {
  constructor() {
    console.log("Module called");
  }
}

class CashuWallet {
  requestTokens() {
    return { proofs: [] };
  }
}

export default {
  CashuMint,
  CashuWallet,
};
