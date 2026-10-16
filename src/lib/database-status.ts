/** Indique où pointe la base, sans jamais afficher le mot de passe. */
function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.hostname}${port}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return "base configurée";
  }
}

export function databaseTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "aucune base configurée";
  return hostOf(url);
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
