import { describe, expect, test } from "@jest/globals";
import { createBulkInsertPayload } from "./database";

describe("Bulk Insert", () => {
  test("create buld insert string", () => {
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
});
