import { NextRequest, NextResponse } from "next/server";
import { messageBaseIndisponible } from "@/lib/db-error";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

function cleanProduct(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const minStock = Number(body.minStock);
  const initialStock = Number(body.initialStock ?? 0);
  if (!name || name.length > 120 || ![price, minStock, initialStock].every(n => Number.isSafeInteger(n) && n >= 0)) return null;
  return { name, price, minStock, initialStock };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const product = cleanProduct(body);
    if (!product) return NextResponse.json({ error: "Veuillez renseigner des informations valides." }, { status: 400 });
    const sku = `PRD-${Date.now().toString(36).toUpperCase()}`;
    const [created] = await db.insert(products).values({ ...product, sku }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: messageBaseIndisponible(error) }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const product = cleanProduct(body);
    if (!Number.isSafeInteger(id) || !product) return NextResponse.json({ error: "Informations invalides." }, { status: 400 });
    const [updated] = await db.update(products).set(product).where(eq(products.id, id)).returning();
    if (!updated) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: messageBaseIndisponible(error) }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: messageBaseIndisponible(error) }, { status: 503 });
  }
}
