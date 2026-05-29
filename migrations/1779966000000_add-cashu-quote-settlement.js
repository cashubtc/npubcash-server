/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.addColumn("l_transactions", {
    cashu_quote_id: { type: "text" },
  });
  pgm.sql(`
    UPDATE l_transactions
    SET cashu_quote_id = mint_hash
    WHERE cashu_quote_id IS NULL;
  `);
  pgm.createIndex("l_transactions", "cashu_quote_id", {
    name: "l_transactions_cashu_quote_id_idx",
  });
  pgm.createTable("l_service_revenue_claims", {
    id: "id",
    created_at: {
      type: "timestamp with time zone",
      notNull: true,
      default: pgm.func("now()"),
    },
    quote_id: { type: "text", notNull: true },
    payment_request: { type: "text", notNull: true },
    amount: { type: "bigint", notNull: true },
    proof: { type: "jsonb", notNull: true },
  });
  pgm.createIndex("l_service_revenue_claims", "quote_id", {
    name: "l_service_revenue_claims_quote_id_idx",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("l_service_revenue_claims");
  pgm.dropIndex("l_transactions", "cashu_quote_id", {
    name: "l_transactions_cashu_quote_id_idx",
  });
  pgm.dropColumn("l_transactions", "cashu_quote_id");
};
