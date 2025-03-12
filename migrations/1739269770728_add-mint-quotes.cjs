/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable("mint_quotes", {
    id: "id",
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("NOW() at time zone 'utc'"),
    },
    mint_url: { type: "text", notNull: true },
    payment_request: { type: "text", notNull: true },
    quote_id: { type: "text", notNull: true },
    expires_at: { notNull: true, type: "timestamp" },
    amount: { notNull: true, type: "integer" },
    pubkey: { type: "text", notNull: true },
    state: { type: "text", notNull: true },
  });
  pgm.createIndex("mint_quotes", "quote_id");
};
