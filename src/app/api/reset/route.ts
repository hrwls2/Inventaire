import { NextRequest, NextResponse } from "next/server";
import { messageBaseIndisponible } from "@/lib/db-error";
import { resetInventory } from "@/lib/inventory";

export const dynamic = "force-dynamic";

// Vide la base. Le mot de confirmation évite une réinitialisation par erreur.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (String(body?.confirmation ?? "").trim().toUpperCase() !== "VIDER") {
      return NextResponse.json({ error: "Confirmation incorrecte : saisissez VIDER pour confirmer." }, { status: 400 });
    }
    const result = await resetInventory();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: messageBaseIndisponible(error) }, { status: 503 });
  }
}
