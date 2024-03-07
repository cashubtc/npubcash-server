import { describe, expect, test } from "@jest/globals";
import { parseInvoice } from "../lightning";

describe("Parsing Lightning Invoice", () => {
  test("Valid invoice...", () => {
    const invoice =
      "lnbc15u1p3xnhl2pp5jptserfk3zk4qy42tlucycrfwxhydvlemu9pqr93tuzlv9cc7g3sdqsvfhkcap3xyhx7un8cqzpgxqzjcsp5f8c52y2stc300gl6s4xswtjpc37hrnnr3c9wvtgjfuvqmpm35evq9qyyssqy4lgd8tj637qcjp05rdpxxykjenthxftej7a2zzmwrmrl70fyj9hvj0rewhzj7jfyuwkwcg9g2jpwtk3wkjtwnkdks84hsnu8xps5vsq4gj5hs";
    const parsed = parseInvoice(invoice);
    expect(parsed).toMatchObject({
      amount: "1500000",
      paymentHash:
        "90570c8d3688ad5012aa5ff982606971ae46b3f9df0a100cb15f05f61718f223",
      memo: "bolt11.org",
    });
  });
});
