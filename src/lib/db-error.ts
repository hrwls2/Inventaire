import { databaseTarget } from "./database-status";

/** Transforme une erreur de base de données en message actionnable pour l'admin. */
export function messageBaseIndisponible(error: unknown): string {
  const detail = error instanceof Error ? error.message : "";
  if (!process.env.DATABASE_URL || detail.includes("DATABASE_URL_MISSING")) {
    return "Base de données non configurée : ajoutez DATABASE_URL dans Vercel (Settings > Environment Variables), puis redéployez. En attendant, ouvrez dashboard-autonome.html pour travailler hors ligne.";
  }
  if (/relation .* does not exist|does not exist/i.test(detail)) {
    return `Les tables d’inventaire n’existent pas encore sur ${databaseTarget()}. Lancez « npx drizzle-kit push » une fois avec cette base, puis redéployez.`;
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|password authentication failed|SSL/i.test(detail)) {
    return `Connexion à ${databaseTarget()} impossible. Vérifiez DATABASE_URL (hôte, mot de passe, sslmode=require) et que la base accepte les connexions externes.`;
  }
  return "Opération impossible pour le moment. Réessayez ; si le problème persiste, vérifiez la base de données.";
}
