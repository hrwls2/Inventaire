import { integer, pgTable, serial, text, timestamp, date } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  price: integer("price").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  initialStock: integer("initial_stock").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const movements = pgTable("movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  date: date("date").notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
