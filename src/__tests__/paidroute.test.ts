import { describe, test } from "vitest";
import request from "supertest";
import { app } from "..";

describe("Paid Request", () => {
  test("", async () => {
    console.log("Running a test");
    const res = await request(app).post("/api/v1/paid").send({ test: 123 });
    console.log(res.statusCode);
  });
});
