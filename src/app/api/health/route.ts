import { db } from "@/db";
import { sql } from "drizzle-orm";
import { databaseConfigured, databaseTarget } from "@/lib/database-status";

export const dynamic = "force-dynamic";

// Répond toujours 200 : l'application est fonctionnelle même si la base
// n'est pas encore reliée (utile pour vérifier un déploiement sur Vercel).
export async function GET() {
  if (!databaseConfigured()) {
    return Response.json({
      ok: true,
      application: "stokio",
      database: "non configurée",
      conseil: "Ajoutez DATABASE_URL dans Vercel (Settings > Environment Variables) puis redéployez.",
    });
  }
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, application: "stokio", database: "connectée", cible: databaseTarget() });
  } catch {
    return Response.json({
      ok: true,
      application: "stokio",
      database: "inaccessible",
      cible: databaseTarget(),
      conseil: "Vérifiez DATABASE_URL et lancez « npx drizzle-kit push » pour créer les tables.",
    });
  }
}
