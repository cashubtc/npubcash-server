/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable("mints", {
    mint_url: { type: "text", notNull: true, unique: true, primaryKey: true },
    last_checked: { type: "timestamptz", notNull: true },
    mint_info: { type: "jsonb", notNull: true },
  });
  pgm.createIndex("mints", "mint_url");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("mints");
};
