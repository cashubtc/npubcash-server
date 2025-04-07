/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable("mint_quotes", {
    id: "id",
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
    mint_url: { type: "text", notNull: true },
    payment_request: { type: "text", notNull: true },
    quote_id: { type: "text", notNull: true },
    expires_at: { notNull: true, type: "timestamptz" },
    amount: { notNull: true, type: "integer" },
    pubkey: { type: "text", notNull: true },
    state: { type: "text", notNull: true },
    paid_at: { type: "timestamptz", notNull: false },
  });
  pgm.createIndex("mint_quotes", "quote_id");
};
