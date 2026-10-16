import { NextRequest, NextResponse } from "next/server";
import { messageBaseIndisponible } from "@/lib/db-error";
import { db } from "@/db";
import { movements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProductStock } from "@/lib/inventory";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = Number(body.productId);
    const quantity = Number(body.quantity);
    const type = String(body.type ?? "");
    const date = String(body.date ?? "");
    const note = String(body.note ?? "").trim();
    if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0 || !["entry", "exit"].includes(type) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || note.length > 300) {
      return NextResponse.json({ error: "Veuillez renseigner un mouvement valide." }, { status: 400 });
    }
    const stock = await getProductStock(productId);
    if (stock === null) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    const autoriserNegatif = body.allowNegative === true;
    if (type === "exit" && !autoriserNegatif && quantity > stock) return NextResponse.json({ error: `Stock insuffisant : ${stock} unité${stock > 1 ? "s" : ""} disponible${stock > 1 ? "s" : ""}.` }, { status: 400 });
    const [created] = await db.insert(movements).values({ productId, quantity, type, date, note }).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: messageBaseIndisponible(error) }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const quantity = Number(body.quantity);
    const date = String(body.date ?? "");
    const note = String(body.note ?? "").trim();
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(quantity) || quantity <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || note.length > 300) {
      return NextResponse.json({ error: "Veuillez renseigner des informations valides." }, { status: 400 });
    }
    const [current] = await db.select().from(movements).where(eq(movements.id, id)).limit(1);
    if (!current) return NextResponse.json({ error: "Mouvement introuvable." }, { status: 404 });
    const stock = (await getProductStock(current.productId)) ?? 0;
    const stockSansCeMouvement = stock + (current.type === "entry" ? -current.quantity : current.quantity);
    if (current.type === "exit" && body.allowNegative !== true && quantity > stockSansCeMouvement) {
      return NextResponse.json({ error: `Stock insuffisant : ${stockSansCeMouvement} unité(s) disponible(s).` }, { status: 400 });
    }
    const [updated] = await db.update(movements).set({ quantity, date, note }).where(eq(movements.id, id)).returning();
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: messageBaseIndisponible(error) }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
    const [deleted] = await db.delete(movements).where(eq(movements.id, id)).returning();
    if (!deleted) return NextResponse.json({ error: "Mouvement introuvable." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: messageBaseIndisponible(error) }, { status: 503 });
  }
}
