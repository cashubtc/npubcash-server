import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimGetController } from "../claimController";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  getEncodedToken: vi.fn(),
  getPaginatedUserReadyClaims: vi.fn(),
  getUserByPubkey: vi.fn(),
  saveWithdrawal: vi.fn(),
  state: "UNSPENT",
  states: undefined as string[] | undefined,
}));

vi.mock("@cashu/cashu-ts", () => ({
  CashuMint: class {
    check = mocks.check;
  },
  CheckStateEnum: {
    UNSPENT: "UNSPENT",
    PENDING: "PENDING",
    SPENT: "SPENT",
  },
  getEncodedToken: mocks.getEncodedToken,
}));

vi.mock("../../models", () => ({
  Claim: {
    getPaginatedUserReadyClaims: mocks.getPaginatedUserReadyClaims,
  },
  User: { getUserByPubkey: mocks.getUserByPubkey },
}));

vi.mock("../../models/withdrawal", () => ({
  WithdrawalStore: {
    getInstance: () => ({ saveWithdrawal: mocks.saveWithdrawal }),
  },
}));

describe("claimGetController", () => {
  const proof = {
    amount: 8,
    id: "keyset-id",
    secret: "proof-secret",
    C: "proof-signature",
  };
  const claim = { id: 7, proof };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MINTURL", "https://mint.example");
    mocks.state = "UNSPENT";
    mocks.states = undefined;
    mocks.getUserByPubkey.mockResolvedValue(undefined);
    mocks.getPaginatedUserReadyClaims.mockResolvedValue({
      claims: [claim],
      count: 1,
      totalPending: 1,
    });
    mocks.check.mockImplementation(async ({ Ys }: { Ys: string[] }) => ({
      states: Ys.map((Y, index) => ({
        Y,
        state: mocks.states?.[index] ?? mocks.state,
        witness: null,
      })),
    }));
    mocks.getEncodedToken.mockReturnValue("encoded-token");
  });

  it("returns and records an unspent proof", async () => {
    const json = vi.fn();

    await claimGetController(
      {
        authData: {
          authorized: true,
          data: { pubkey: "pubkey", npub: "npub1recipient" },
        },
      } as never,
      { json, status: vi.fn() } as never,
    );

    expect(mocks.getEncodedToken).toHaveBeenCalledWith({
      memo: "",
      token: [{ mint: "https://mint.example", proofs: [proof] }],
    });
    expect(mocks.saveWithdrawal).toHaveBeenCalledWith([claim], "pubkey");
    expect(json).toHaveBeenCalledWith({
      error: false,
      data: { token: "encoded-token", count: 1, totalPending: 1 },
    });
  });

  it("does not return or record a pending proof", async () => {
    mocks.state = "PENDING";
    const json = vi.fn();

    await claimGetController(
      {
        authData: {
          authorized: true,
          data: { pubkey: "pubkey", npub: "npub1recipient" },
        },
      } as never,
      { json, status: vi.fn() } as never,
    );

    expect(mocks.getEncodedToken).not.toHaveBeenCalled();
    expect(mocks.saveWithdrawal).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({
      error: true,
      message: "No proofs to claim",
    });
  });

  it("excludes a spent proof from the token, withdrawal, and count", async () => {
    const spentClaim = {
      id: 8,
      proof: {
        amount: 4,
        id: "keyset-id",
        secret: "spent-secret",
        C: "spent-signature",
      },
    };
    mocks.getPaginatedUserReadyClaims.mockResolvedValue({
      claims: [claim, spentClaim],
      count: 2,
      totalPending: 2,
    });
    mocks.states = ["UNSPENT", "UNSPENT", "SPENT", "SPENT"];
    const json = vi.fn();

    await claimGetController(
      {
        authData: {
          authorized: true,
          data: { pubkey: "pubkey", npub: "npub1recipient" },
        },
      } as never,
      { json, status: vi.fn() } as never,
    );

    expect(mocks.getEncodedToken).toHaveBeenCalledWith({
      memo: "",
      token: [{ mint: "https://mint.example", proofs: [proof] }],
    });
    expect(mocks.saveWithdrawal).toHaveBeenCalledWith([claim], "pubkey");
    expect(json).toHaveBeenCalledWith({
      error: false,
      data: { token: "encoded-token", count: 1, totalPending: 2 },
    });
  });

  it("does not return a proof spent under its legacy identifier", async () => {
    mocks.check.mockImplementationOnce(async ({ Ys }: { Ys: string[] }) => ({
      states:
        Ys.length === 2
          ? [
              { Y: Ys[0], state: "UNSPENT", witness: null },
              { Y: Ys[1], state: "SPENT", witness: null },
            ]
          : [{ Y: Ys[0], state: "UNSPENT", witness: null }],
    }));
    const json = vi.fn();

    await claimGetController(
      {
        authData: {
          authorized: true,
          data: { pubkey: "pubkey", npub: "npub1recipient" },
        },
      } as never,
      { json, status: vi.fn() } as never,
    );

    expect(mocks.check).toHaveBeenCalledTimes(1);
    expect(mocks.check.mock.calls[0][0].Ys).toHaveLength(2);
    expect(mocks.getEncodedToken).not.toHaveBeenCalled();
    expect(mocks.saveWithdrawal).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({
      error: true,
      message: "No proofs to claim",
    });
  });
});
