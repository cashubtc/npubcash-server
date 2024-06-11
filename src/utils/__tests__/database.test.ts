import { afterEach, describe, expect, test, vi } from "vitest";
import { createBulkInsertPayload, createBulkInsertQuery } from "../database";

const mockedMethod = vi.hoisted(() => {
  return vi.fn();
});

vi.mock("pg", () => {
  return {
    Pool: vi.fn(() => ({
      query: mockedMethod,
    })),
  };
});

describe("Bulk Insert", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  test("create bulk insert string", () => {
    const columns = ["name", "age", "gender"];
    const values = [
      ["Dan", 24, "male"],
      ["Anna", 21, "female"],
      ["Steve", 36, "male"],
      ["Steve", 36, "male"],
    ];
    const invalidValues = [["Dan", "hockey", 23, "male"]];
    const insertString = createBulkInsertPayload(columns, values);
    expect(insertString.flatValues.length).toBe(12);
    expect(() => createBulkInsertPayload(columns, invalidValues)).toThrow();
  });
  test("execute bulk insert query", () => {
    mockedMethod.mockReturnValue(Promise.resolve("bla"));
    return createBulkInsertQuery(
      "test",
      ["name", "age", "gender"],
      [
        ["Dan", 24, "male"],
        ["Anna", 21, "female"],
        ["Steve", 36, "male"],
        ["Steve", 36, "male"],
      ],
    ).then((e) => {
      expect(mockedMethod).toHaveBeenCalledWith(
        "INSERT INTO test (name,age,gender) VALUES ($1,$2,$3),($4,$5,$6),($7,$8,$9),($10,$11,$12);",
        [
          "Dan",
          24,
          "male",
          "Anna",
          21,
          "female",
          "Steve",
          36,
          "male",
          "Steve",
          36,
          "male",
        ],
      );
    });
  });
});
