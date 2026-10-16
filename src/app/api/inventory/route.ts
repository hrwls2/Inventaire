import { NextResponse } from "next/server";
import { getInventoryData } from "@/lib/inventory";
import { messageBaseIndisponible } from "@/lib/db-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getInventoryData());
  } catch (error) {
    return NextResponse.json({ error: messageBaseIndisponible(error) }, { status: 503 });
  }
}
