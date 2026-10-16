import { db } from "@/db";
import { movements, products } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";

export type InventoryProduct = {
  id: number;
  name: string;
  sku: string;
  price: number;
  minStock: number;
  initialStock: number;
  entries: number;
  exits: number;
  stock: number;
  value: number;
  createdAt: string;
};

export type InventoryMovement = {
  id: number;
  productId: number;
  productName: string;
  type: string;
  quantity: number;
  date: string;
  note: string;
  createdAt: string;
};

export type InventoryData = {
  products: InventoryProduct[];
  movements: InventoryMovement[];
};

// Aucune donnée d'exemple : l'inventaire démarre vide et se remplit
// uniquement avec ce que l'administrateur ajoute.
export async function getInventoryData(): Promise<InventoryData> {
  const [productRows, movementRows] = await Promise.all([
    db.select().from(products).orderBy(asc(products.id)),
    db.select().from(movements).orderBy(desc(movements.date), desc(movements.createdAt), desc(movements.id)),
  ]);
  const productMap = new Map(productRows.map(p => [p.id, p]));
  const totals = new Map<number, { entries: number; exits: number }>();
  for (const movement of movementRows) {
    const current = totals.get(movement.productId) ?? { entries: 0, exits: 0 };
    if (movement.type === "entry") current.entries += movement.quantity;
    else current.exits += movement.quantity;
    totals.set(movement.productId, current);
  }
  return {
    products: productRows.map(p => {
      const { entries, exits } = totals.get(p.id) ?? { entries: 0, exits: 0 };
      const stock = p.initialStock + entries - exits;
      return { ...p, createdAt: p.createdAt.toISOString(), entries, exits, stock, value: stock * p.price };
    }),
    movements: movementRows.map(m => ({ ...m, productName: productMap.get(m.productId)?.name ?? "Produit supprimé", createdAt: m.createdAt.toISOString() })),
  };
}

export async function getProductStock(productId: number) {
  const row = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!row.length) return null;
  const moves = await db.select().from(movements).where(eq(movements.productId, productId));
  return row[0].initialStock + moves.reduce((total, m) => total + (m.type === "entry" ? m.quantity : -m.quantity), 0);
}

// Vide entièrement l'inventaire : produits, mouvements et compteurs d'identifiants.
export async function resetInventory() {
  const removedMovements = await db.delete(movements).returning({ id: movements.id });
  const removedProducts = await db.delete(products).returning({ id: products.id });
  await db.execute(sqlRestart(products));
  await db.execute(sqlRestart(movements));
  return { products: removedProducts.length, movements: removedMovements.length };
}

function sqlRestart(table: typeof products | typeof movements) {
  const name = table === products ? "products" : "movements";
  // Drizzle ne fournit pas d'assistant pour ALTER SEQUENCE : SQL brut nécessaire.
  return sql.raw(`ALTER SEQUENCE IF EXISTS ${name}_id_seq RESTART WITH 1`);
}
