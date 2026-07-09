export function createBulkInsertPayload(
  columnArray: string[],
  nestedValueArray: unknown[][],
) {
  let counter = 1;
  const sanitizedValueArray: string[] = [];
  nestedValueArray.forEach((innerArray) => {
    if (columnArray.length !== innerArray.length) {
      throw new Error("Value-Column mismatch");
    }
    const innerSanitizedValueArray: string[] = [];
    for (let i = 0; i < innerArray.length; i++) {
      innerSanitizedValueArray.push(`$${counter}`);
      counter++;
    }
    sanitizedValueArray.push(innerSanitizedValueArray.join(","));
  });
  const valueStrings = sanitizedValueArray
    .map((innerValue) => `(${innerValue})`)
    .join(",");
  return { valueString: valueStrings, flatValues: nestedValueArray.flat() };
}

export function createSanitizedValueString(n: number) {
  return `(${Array.from({ length: n }, (_, i) => `$${i + 1}`).join(", ")})`;
}
