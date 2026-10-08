import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const portiaContent = sqliteTable("portia_content", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by").notNull(),
});
