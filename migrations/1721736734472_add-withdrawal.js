/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable("l_withdrawals", {
    id: "id",
    amount: { type: "integer", notNull: true },
    pubkey: { type: "text", notNull: true },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("now()"),
    },
    claim_ids: { notNull: true, type: "integer[]" },
  });
};
