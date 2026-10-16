import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const temporary = await mkdtemp(join(tmpdir(), "stokio dynamique "));
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const portableCopy = join(temporary, "dashboard indépendant.html");
await copyFile(resolve("public/dashboard-autonome.html"), portableCopy);

async function fill(form, selector, values) {
  for (const [key, value] of Object.entries(values)) await form.locator(`${selector} [name="${key}"]`).fill(String(value));
}

// Vérifie que tout l'affichage est calculé à partir des données (base vide au départ).
async function verifierDynamique(file, label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1060 }, acceptDownloads: true });
  await context.route(/^https?:/, route => route.abort());
  await context.setOffline(true);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);

  // Vidage complet : on repart toujours de zéro pour ce test.
  await page.evaluate(() => window.StokioLocal.vider());
  await page.reload();
  await expect(page.locator("#compteurNav")).toHaveText("0");
  await expect(page.locator("#accueilVide")).toBeVisible();
  await expect(page.locator("#apercuPanel")).toBeHidden();
  await expect(page.locator("#graphNote")).toBeVisible();
  await expect(page.locator("#statsDashboard .stat").first().locator("b")).toHaveText("0");
  await page.screenshot({ path: join(temporary, `${label}-vide.png`), fullPage: true });

  // Ajout d'un produit puis contrôle des calculs.
  await page.locator('.head-actions button[onclick="ouvrirFormulaireProduit()"]').click();
  await fill(page, "#formProduit", { name: "Ciment 50 kg", price: 5000, minStock: 4, initialStock: 10 });
  await page.locator('#formProduit button[type="submit"]').click();
  await expect(page.locator("#accueilVide")).toBeHidden();
  await expect(page.locator("#apercuPanel")).toBeVisible();
  await expect(page.locator("#statsDashboard .stat").nth(1).locator("b")).toHaveText("10");
  await expect(page.locator("#statsDashboard .stat").nth(2).locator("b")).toContainText("50 000");

  // Entrée et sortie datées : stock, valeur et graphique mis à jour.
  await page.locator('#navigation [data-page="produits"]').click();
  const ligne = page.locator("#tableProduits tbody tr").first();
  for (const [title, quantite, date] of [["Entrée de stock", 5, "2026-03-02"], ["Sortie de stock", 3, "2026-03-04"]]) {
    await ligne.locator(`[title="${title}"]`).click();
    await page.locator('#formMouvement [name="quantity"]').fill(String(quantite));
    await page.locator('#formMouvement [name="date"]').fill(date);
    await page.locator('#formMouvement [name="note"]').fill("Contrôle dynamique");
    await page.locator('#formMouvement button[type="submit"]').click();
    await expect(page.locator("#modalMouvement")).toBeHidden();
  }
  await expect(ligne.locator("td").nth(3)).toHaveText("+5");
  await expect(ligne.locator("td").nth(4)).toHaveText("−3");
  await expect(ligne.locator("td").nth(5)).toHaveText("12");
  await expect(ligne.locator("td").nth(7)).toContainText("60 000");
  await expect(page.locator("#graphNote")).toBeHidden();
  await expect(page.locator("#statsMouvements .stat").first().locator("b")).toContainText("5");

  // Les périodes recalculent les totaux sans recharger la page.
  await page.locator('#navigation [data-page="mouvements"]').click();
  await page.locator('#periodesMouvements [data-periode="jour"]').click();
  await expect(page.locator("#compteMouvements")).toHaveText("0");
  await expect(page.locator("#statsMouvements .stat").first().locator("b")).toHaveText("+0");
  await expect(page.locator("#sousTitreMouvements")).toContainText("aujourd");
  await page.locator('#periodesMouvements [data-periode="tout"]').click();
  await expect(page.locator("#compteMouvements")).toHaveText("2");

  // Le récapitulatif suit les mouvements et calcule le montant total.
  await page.locator('#navigation [data-page="recap"]').click();
  await expect(page.locator("#statsRecap .stat").nth(1).locator("b")).toHaveText("12");
  await expect(page.locator("#tableRecap tfoot")).toContainText("MONTANT DU STOCK");
  await expect(page.locator("#tableAlertes tbody tr")).toHaveCount(0);

  // Une sortie qui fait passer le produit sous son minimum crée l'alerte.
  await page.locator('#navigation [data-page="produits"]').click();
  await ligne.locator('[title="Sortie de stock"]').click();
  await page.locator('#formMouvement [name="quantity"]').fill("10");
  await page.locator('#formMouvement [name="date"]').fill("2026-03-05");
  await page.locator('#formMouvement button[type="submit"]').click();
  await expect(ligne.locator("td").nth(5)).toHaveText("2");
  await expect(ligne.locator(".tag-bas")).toContainText("Stock faible");

  await page.locator('#navigation [data-page="recap"]').click();
  await expect(page.locator("#tableAlertes tbody tr")).toHaveCount(1);
  await expect(page.locator("#tableAlertes tbody tr td").nth(3)).toHaveText("2");
  await expect(page.locator("#statsRecap .stat").nth(3).locator("b")).toHaveText("1");

  // Réinitialisation de tout l'inventaire depuis l'interface.
  await page.locator("#btnVider").click();
  await expect(page.locator("#btnConfirmerVidage")).toBeDisabled();
  await page.locator('#formVidage [name="confirmation"]').fill("vider");
  await expect(page.locator("#btnConfirmerVidage")).toBeEnabled();
  await page.locator("#btnConfirmerVidage").click();
  await expect(page.locator("#modalVidage")).toBeHidden();
  await expect(page.locator("#compteurNav")).toHaveText("0");
  await page.locator('#navigation [data-page="dashboard"]').click();
  await expect(page.locator("#accueilVide")).toBeVisible();
  await expect(page.locator("#apercuPanel")).toBeHidden();
  await page.screenshot({ path: join(temporary, `${label}-apres-vidage.png`), fullPage: true });
  assert.deepEqual(errors, [], "Aucune erreur JavaScript");
  console.log(`PASS ${label} : démarrage vide, calculs, périodes, alertes, réinitialisation.`);
  await context.close();
}

async function verifierStockageBloque() {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new DOMException("Blocked", "SecurityError"); };
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(portableCopy).href);
  await expect(page.locator("#erreurChargement")).toContainText("stockage local");
  await context.close();
  console.log("PASS stockage bloqué : message explicite.");
}

async function verifierServeur(base) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  const comptes = async () => (await (await fetch(`${base}/api/inventory`)).json()).products.length;
  assert.equal(await comptes(), 0, "La base doit être vide au démarrage du test");
  try {
    await page.goto(base);
    await expect(page.locator("#compteurNav")).toHaveText("0");
    await expect(page.locator("#noticeLocale")).toBeHidden();
    await expect(page.locator("#accueilVide")).toBeVisible();

    // Aucune donnée d'exemple ne doit revenir après une simple actualisation.
    await page.reload();
    await expect(page.locator("#compteurNav")).toHaveText("0");

    await page.locator('.head-actions button[onclick="ouvrirFormulaireProduit()"]').click();
    await fill(page, "#formProduit", { name: "Produit serveur", price: 2000, minStock: 1, initialStock: 6 });
    await page.locator('#formProduit button[type="submit"]').click();
    await expect(page.locator("#accueilVide")).toBeHidden();
    const crees = await (await fetch(`${base}/api/inventory`)).json();
    const id = crees.products[0]?.id;
    assert(id, "Le produit doit être enregistré en base");

    const mouvement = await fetch(`${base}/api/movements`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id, type: "exit", quantity: 2, date: "2026-03-05", note: "Test" }),
    });
    assert.equal(mouvement.status, 201);

    const vidage = await fetch(`${base}/api/reset`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "VIDER" }),
    });
    const resultat = await vidage.json();
    assert.equal(vidage.status, 200, "La réinitialisation doit fonctionner");
    assert.equal(await comptes(), 0, "La base doit être vide après réinitialisation");
    assert(resultat.products >= 1, "Le nombre de produits supprimés doit être signalé");

    const refus = await fetch(`${base}/api/reset`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "non" }),
    });
    assert.equal(refus.status, 400, "Une mauvaise confirmation doit être refusée");

    const retour = await page.reload();
    assert(retour, "La page doit se recharger sur un inventaire vide");
    await expect(page.locator("#compteurNav")).toHaveText("0");
    console.log("PASS serveur : base vide au départ, aucune donnée d'exemple, réinitialisation fonctionnelle.");
  } finally { await context.close(); }
}

try {
  await verifierDynamique(resolve("public/dashboard.html"), "fichiers-separes");
  await verifierDynamique(portableCopy, "fichier-autonome");
  await verifierStockageBloque();
  if (process.env.TEST_BASE_URL) await verifierServeur(process.env.TEST_BASE_URL);
  console.log(`Vérifications réussies. Captures : ${temporary}`);
} finally { await browser.close(); }
