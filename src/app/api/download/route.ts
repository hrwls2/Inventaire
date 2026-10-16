import { NextResponse } from "next/server";
import { getInventoryData } from "@/lib/inventory";
import { createPortableDashboard } from "@/lib/portable-dashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const inventory = await getInventoryData();
    const html = await createPortableDashboard(inventory);
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": 'attachment; filename="dashboard-autonome.html"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Le téléchargement est temporairement indisponible. Revenez au tableau de bord et réessayez.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
