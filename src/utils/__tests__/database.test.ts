import { describe, expect, test } from "vitest";
import {
  createBulkInsertPayload,
  createSanitizedValueString,
} from "../database";

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

describe("Create Value Strings", () => {
  test("Value string without offset", () => {
    const string = createSanitizedValueString(3);
    expect(string).toEqual("($1, $2, $3)");
  });
  test("Value string with offset", () => {
    const string = createSanitizedValueString(3, 2);
    expect(string).toEqual("($3, $4, $5)");
  });
});
