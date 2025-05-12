/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.addColumn("l_users", {
    lock_quote: { type: "bool", default: false },
  });
  pgm.addColumn("mint_quotes", {
    locked: { type: "boolean", notNull: true, default: false },
  });
};
