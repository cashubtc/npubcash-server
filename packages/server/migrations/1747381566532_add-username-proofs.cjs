/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable("proofs", {
    id: "id",
    amount: { type: "integer", notNull: true },
    keyset_id: { type: "text", notNull: true },
    secret: { type: "text", notNull: true },
    C: { type: "text", notNull: true },
    state: { type: "text", notNull: true },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("proofs");
};
