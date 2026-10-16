import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { InventoryData } from "./inventory";

const publicDirectory = () => join(process.cwd(), "public");

/** Lit un fichier sans faire échouer la génération s'il est absent. */
async function readOptional(name: string): Promise<string | null> {
  try {
    return await readFile(join(publicDirectory(), name), "utf8");
  } catch {
    return null;
  }
}

async function readOptionalBinary(name: string): Promise<Buffer | null> {
  try {
    return await readFile(join(publicDirectory(), name));
  } catch {
    return null;
  }
}

function inlineScript(source: string) {
  return `<script>\n${source.replace(/<\/script/gi, "<\\/script")}\n</script>`;
}

function json(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// Conserve un seul fichier éditable de chaque type dans public/.
// La version autonome est générée à partir de ces fichiers, jamais maintenue à la main.
// Les polices sont facultatives : si elles sont absentes, le fichier autonome reste
// utilisable avec la police de secours du navigateur, et la compilation ne casse pas.
export async function createPortableDashboard(snapshot?: InventoryData): Promise<string> {
  const [template, styles, configuration, localStore, application] = await Promise.all([
    readOptional("dashboard.html"),
    readOptional("styles.css"),
    readOptional("config.js"),
    readOptional("local-inventory.js"),
    readOptional("app.js"),
  ]);

  if (!template || !styles || !configuration || !localStore || !application) {
    const manquants = [
      !template && "dashboard.html", !styles && "styles.css", !configuration && "config.js",
      !localStore && "local-inventory.js", !application && "app.js",
    ].filter(Boolean).join(", ");
    throw new Error(`Fichiers sources introuvables dans public/ : ${manquants}.`);
  }

  const [dmSans, jakarta] = await Promise.all([
    readOptionalBinary("fonts/dm-sans.woff2"),
    readOptionalBinary("fonts/plus-jakarta-sans.woff2"),
  ]);

  let css = styles;
  if (dmSans && jakarta) {
    css = css
      .replaceAll("./fonts/dm-sans.woff2", `data:font/woff2;base64,${dmSans.toString("base64")}`)
      .replaceAll("./fonts/plus-jakarta-sans.woff2", `data:font/woff2;base64,${jakarta.toString("base64")}`);
  }

  const settings = "window.MODE_AUTONOME = true;\n" + (snapshot
    ? `window.INVENTAIRE_ID = ${json(randomUUID())};\nwindow.INVENTAIRE_INITIAL = ${json(snapshot)};\n`
    : "");

  const html = template
    .replace('<link rel="stylesheet" href="./styles.css">', () => `<style>\n${css}\n</style>`)
    .replace('<script src="./config.js"></script>', () => inlineScript(settings + configuration))
    .replace('<script src="./local-inventory.js"></script>', () => inlineScript(localStore))
    .replace('<script src="./app.js"></script>', () => inlineScript(application));

  if (!html.includes("window.MODE_AUTONOME")) {
    throw new Error("Le modèle dashboard.html ne correspond plus aux balises attendues.");
  }
  return html;
}

/**
 * Écrit la version autonome dans public/. Appelée avant la compilation.
 * Un échec n'interrompt jamais la compilation : le site reste déployable et
 * « Télécharger la version hors ligne » continue de fonctionner via /api/download.
 */
export async function writePortableDashboard(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const html = await createPortableDashboard();
    const target = join(publicDirectory(), "dashboard-autonome.html");
    const previous = await readFile(target, "utf8").catch(() => "");
    if (previous !== html) await writeFile(target, html, "utf8");
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Erreur inconnue";
    console.warn(`[stokio] Version autonome non régénérée (${reason}). Le déploiement continue.`);
    return { ok: false, reason };
  }
}
