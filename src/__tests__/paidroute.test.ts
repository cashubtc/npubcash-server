import { describe, expect, test, jest } from "@jest/globals";
import request from "supertest";
import { app } from "../index";
import { Transaction } from "../models";

const body = {
  accountId: "1580f7f2-0e4c-4187-b97f-9ed6eaff8f55",
  eventType: "receive.lightning",
  walletId: "21087d73-80d8-4556-a73a-e1b6b0657784",
  transaction: {
    createdAt: "2023-11-21T01:49:38.375Z",
    id: "655cd1926445716f60b89418",
    initiationVia: {
      paymentHash:
        "bf6b61f814b2e2284f5cbb7c9f9e67887018ffe3f53bedb9b70dec0a15ebca1c",
      pubkey:
        "d75a81acb76fd85dafe491799bbd1940a25e8a8fa776cacccda4ee8444555e3e",
      type: "lightning",
    },
    memo: null,
    settlementAmount: 2707,
    settlementCurrency: "BTC",
    settlementDisplayAmount: "1.00",
    settlementDisplayFee: "0.00",
    settlementDisplayPrice: {
      base: "36941263391",
      displayCurrency: "USD",
      offset: "12",
      walletCurrency: "BTC",
    },
    settlementFee: 0,
    settlementVia: {
      type: "lightning",
    },
    status: "success",
    walletId: "21087d73-80d8-4556-a73a-e1b6b0657784",
  },
};

jest.mock("../models/transaction.ts");

describe("Paid Request", () => {
  jest
    .spyOn(Transaction, "getTransactionByHash")
    // @ts-ignore
    .mockImplementation(() => "123");
  test("", async () => {
    process.env.NODE_ENV = "development";

    const res = await request(app)
      .post("/api/v1/paid")
      .send(body)
      .set("content-type", "application/json");
    console.log(res.statusCode);
    expect(res.statusCode).toBe(200);
  });
});
