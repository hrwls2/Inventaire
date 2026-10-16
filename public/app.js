/* =========================================================================
   LOGIQUE DU TABLEAU DE BORD — tout est calculé à partir des données réelles
   Les réglages (nom, devise, couleurs, textes) sont dans public/config.js
   ========================================================================= */

/* --- 1. RÉGLAGES & OUTILS -------------------------------------------- */
const C = window.CONFIG;
const modeLocal = window.StokioLocal.actif;
let operationEnCours = false;
let donneesChargees = false;
let etat = {
  produits: [], mouvements: [], page: "dashboard",
  rechProduits: "", rechMouvements: "",
  filtreProduits: "tous", filtreMouvements: "tous",
  periodeMouvements: "tout",
};

const $ = (sel) => document.querySelector(sel);
// Utiliser elements.namedItem évite les collisions avec les propriétés id/name du formulaire.
const champForm = (formulaire, nom) => formulaire.elements.namedItem(nom);
const nb = (n) => new Intl.NumberFormat("fr-FR").format(n || 0);
const argent = (n) => (C.deviseAvantMontant ? `${C.devise} ${nb(n)}` : `${nb(n)} ${C.devise}`);
const jour = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const dateISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const aujourdhui = () => dateISO(new Date());
const txt = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ico = (nom, petit) => `<svg class="ic${petit ? " ic-sm" : ""}"><use href="#i-${nom}"/></svg>`;
const initiales = (t) => t.trim().split(/\s+/).map((m) => m[0]).join("").slice(0, 2).toUpperCase();
const pluriel = (n, un, plus) => `${n} ${n > 1 ? plus : un}`;

/* --- 2. APPLICATION DE LA CONFIGURATION ------------------------------ */
function appliquerConfig() {
  const r = document.documentElement.style;
  r.setProperty("--principale", C.couleurs.principale);
  r.setProperty("--menu", C.couleurs.menu);
  r.setProperty("--entree", C.couleurs.entree);
  r.setProperty("--sortie", C.couleurs.sortie);
  r.setProperty("--alerte", C.couleurs.alerte);
  r.setProperty("--fond", C.couleurs.fond);
  $("#nomEntreprise").innerHTML = `${txt(C.nomEntreprise)}<i>.</i>`;
  $("#sousTitre").textContent = C.sousTitre;
  $("#nomEspace").textContent = C.nomEspace;
  $("#initialesEspace").textContent = C.nomEntreprise[0].toUpperCase();
  $("#nomAdmin").textContent = C.nomAdmin;
  $("#roleAdmin").textContent = C.roleAdmin;
  $("#initialesAdmin").textContent = initiales(C.nomAdmin);
  $("#initialesAdmin2").textContent = initiales(C.nomAdmin);
  $("#nomPied").textContent = C.nomEntreprise;
  $("#annee").textContent = new Date().getFullYear();
  $("#dateDuJour").textContent = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  $("#legendeJours").textContent = `Entrées et sorties des ${C.joursGraphique} derniers jours`;
  document.title = `${C.nomEntreprise} — Gestion d'inventaire`;
  $("#navigation").innerHTML = [
    ["dashboard", "grid", C.menus.dashboard, ""],
    ["produits", "box", C.menus.produits, "compteurNav"],
    ["mouvements", "activity", C.menus.mouvements, "compteurMouvNav"],
    ["recap", "doc", C.menus.recap, ""],
  ].map(([id, icone, libelle, badge]) => `<button class="nav-item" data-page="${id}" onclick="allerA('${id}')">${ico(icone)}<span>${txt(libelle)}</span>${badge ? `<em id="${badge}">0</em>` : ""}</button>`).join("");
  champForm($("#formMouvementRapide"), "date").value = aujourdhui();
  champForm($("#formProduitRapide"), "minStock").value = C.seuilAlerteParDefaut;
  $("#noticeLocale").hidden = !modeLocal;
  $("#telechargerAutonome").hidden = modeLocal;
  $("#btnVider").innerHTML = `${ico("trash", true)} Vider l’inventaire`;
}

/* --- 3. COMMUNICATION AVEC LE SERVEUR OU LE STOCKAGE LOCAL ------------ */
async function api(url, methode = "GET", corps) {
  // Un fichier ouvert par double-clic ne peut pas appeler l'API PostgreSQL.
  if (modeLocal) return window.StokioLocal.requete(url, methode, corps);
  let rep;
  try {
    rep = await fetch(new URL(url.replace(/^\//, ""), document.baseURI), {
      method: methode,
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: corps ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw new Error("Le serveur est inaccessible. Vérifiez votre connexion puis réessayez. Pour travailler sans serveur, ouvrez dashboard-autonome.html.");
  }
  const data = await rep.json().catch(() => {
    throw new Error("Le serveur d’inventaire n’est pas disponible ici. Utilisez dashboard-autonome.html pour une ouverture sans serveur.");
  });
  if (!rep.ok) throw new Error(data.error || "Une erreur est survenue.");
  return data;
}

async function charger() {
  const data = await api("/api/inventory");
  if (!Array.isArray(data.products) || !Array.isArray(data.movements)) throw new Error("Les données d’inventaire sont invalides.");
  etat.produits = data.products;
  etat.mouvements = data.movements;
  donneesChargees = true;
  $("#erreurChargement").hidden = true;
  $("#etatStockage").textContent = modeLocal ? "Mode local · stockage dans ce navigateur" : "Données enregistrées dans la base";
  dessinerTout();
}

async function action(fn, message) {
  if (operationEnCours) return false;
  if (!donneesChargees) { toast("Attendez le chargement de l’inventaire avant de le modifier.", true); return false; }
  operationEnCours = true;
  const boutons = document.querySelectorAll('button[type="submit"], #btnConfirmerSuppression, #btnConfirmerVidage');
  boutons.forEach(b => b.disabled = true);
  try {
    await fn();
    await charger();
    if (message) toast(message);
    return true;
  } catch (e) {
    dessinerTout();
    toast(e.message, true);
    return false;
  } finally {
    operationEnCours = false;
    boutons.forEach(b => b.disabled = false);
  }
}

/* --- 4. CALCULS DYNAMIQUES ------------------------------------------- */
function totaux(listeProduits = etat.produits, listeMouvements = etat.mouvements) {
  return {
    produits: listeProduits.length,
    unites: listeProduits.reduce((s, x) => s + x.stock, 0),
    valeur: listeProduits.reduce((s, x) => s + x.value, 0),
    alertes: listeProduits.filter((x) => x.stock <= x.minStock).length,
    entrees: listeMouvements.filter((m) => m.type === "entry").reduce((s, m) => s + m.quantity, 0),
    sorties: listeMouvements.filter((m) => m.type === "exit").reduce((s, m) => s + m.quantity, 0),
  };
}
const statut = (p) => (p.stock <= 0 ? ["tag-rupture", "Rupture"] : p.stock <= p.minStock ? ["tag-bas", "Stock faible"] : ["tag-ok", "En stock"]);

// Bornes des périodes proposées dans la page Mouvements.
const PERIODES = [
  { id: "jour", libelle: "Aujourd’hui", jours: 1 },
  { id: "semaine", libelle: "7 jours", jours: 7 },
  { id: "mois", libelle: "30 jours", jours: 30 },
  { id: "tout", libelle: "Tout", jours: Infinity },
];
const limitePeriode = (id) => {
  const periode = PERIODES.find((p) => p.id === id) ?? PERIODES[3];
  if (periode.jours === Infinity) return null;
  const d = new Date();
  d.setDate(d.getDate() - (periode.jours - 1));
  return dateISO(d);
};

/* --- 5. AFFICHAGE GÉNÉRAL -------------------------------------------- */
function dessinerTout() {
  const t = totaux();
  document.querySelectorAll("#navigation .nav-item").forEach((b) => b.classList.toggle("active", b.dataset.page === etat.page));
  document.querySelectorAll("[data-page]").forEach((s) => { if (s.tagName === "SECTION") s.hidden = s.dataset.page !== etat.page; });
  const titres = {
    dashboard: [C.menus.dashboard, "Gardez un œil sur votre stock, en toute simplicité."],
    produits: [C.menus.produits, "Ajoutez, modifiez ou supprimez vos références."],
    mouvements: [C.menus.mouvements, "Suivez chaque entrée et sortie, avec sa date."],
    recap: [C.menus.recap, "Le total de votre stock, comme dans votre fichier Excel."],
  }[etat.page];
  $("#titrePage").innerHTML = `${txt(titres[0])}<i>.</i>`;
  $("#sousTitrePage").textContent = titres[1];
  $("#filPage").textContent = titres[0];
  $("#compteurNav").textContent = t.produits;
  $("#compteurMouvNav").textContent = etat.mouvements.length;
  $("#cloche").innerHTML = ico("bell") + (t.alertes ? "<i></i>" : "");
  $("#accueilVide").hidden = t.produits > 0;

  remplirListesProduits();
  dessinerDashboard(t);
  dessinerProduits();
  dessinerMouvements();
  dessinerRecap(t);
}

function carte(icone, teinte, label, valeur, note, options = {}) {
  return `<div class="stat ${options.clic ? "cliquable" : ""}" ${options.clic ? `onclick="${options.clic}"` : ""}>
    <div class="stat-top"><span class="stat-ic ${teinte}">${ico(icone)}</span>${ico("dots")}</div>
    <label>${txt(label)}</label><b class="${options.petit ? "petit" : ""}">${txt(valeur)}</b>
    <span class="note">${ico(options.noteIcone || "up", true)} ${txt(note)}</span></div>`;
}

const tableVide = (titre, detail) => `<div class="vide"><span>${ico("search")}</span><b>${titre}</b><em>${detail}</em></div>`;

/* --- 6. PAGE : VUE D'ENSEMBLE ---------------------------------------- */
function dessinerDashboard(t) {
  const dernier = etat.mouvements[0];
  $("#statsDashboard").innerHTML =
    carte("box", "t-bleu", "Total produits", nb(t.produits), t.produits ? "Références enregistrées" : "Inventaire vide", { noteIcone: "box" }) +
    carte("grid", "t-vert", "Unités en stock", nb(t.unites), t.unites ? "Disponibles actuellement" : "Aucune unité en stock") +
    carte("chart", "t-violet", "Valeur du stock", argent(t.valeur), "Montant total du stock", { petit: true }) +
    carte("alert", "t-orange", "Alertes de stock", nb(t.alertes), t.alertes ? "Produits à réapprovisionner" : "Aucune alerte", { noteIcone: "alert", clic: t.alertes ? "voirAlertes()" : "" });

  // Graphique calculé sur les N derniers jours définis dans config.js
  const jours = [];
  for (let i = C.joursGraphique - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const cle = dateISO(d);
    const duJour = etat.mouvements.filter((m) => m.date === cle);
    jours.push({ cle, libelle: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), e: duJour.filter((m) => m.type === "entry").reduce((s, m) => s + m.quantity, 0), s: duJour.filter((m) => m.type === "exit").reduce((s, m) => s + m.quantity, 0) });
  }
  const totalPeriode = jours.reduce((s, j) => s + j.e + j.s, 0);
  $("#graphNote").hidden = totalPeriode > 0;
  const max = Math.max(5, ...jours.flatMap((j) => [j.e, j.s]));
  $("#graphY").innerHTML = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0].map((v) => `<span>${v}</span>`).join("");
  $("#graphBarres").innerHTML = jours.map((j) => `<div class="jour">
      <div class="b e" style="height:${(j.e / max) * 100}%" title="${j.e} entrée(s) — ${jour(j.cle)}"></div>
      <div class="b s" style="height:${(j.s / max) * 100}%" title="${j.s} sortie(s) — ${jour(j.cle)}"></div>
      <label>${j.libelle}</label></div>`).join("");

  $("#activiteRecente").innerHTML = etat.mouvements.length
    ? etat.mouvements.slice(0, 5).map((m) => `<div class="ligne-act">
        <span class="rond ${m.type === "entry" ? "e" : "s"}">${ico(m.type === "entry" ? "in" : "out", true)}</span>
        <div><strong>${txt(m.productName)}</strong><em>${m.type === "entry" ? "Entrée" : "Sortie"} · ${jour(m.date)}</em></div>
        <b class="${m.type === "entry" ? "vert" : "rouge"}">${m.type === "entry" ? "+" : "−"}${m.quantity}</b></div>`).join("")
    : `<p style="padding:24px 0;color:#9aa8a8;font-size:12px">Aucun mouvement enregistré.</p>`;
  $("#tableApercu").innerHTML = tableProduitsHTML(etat.produits.slice(0, 6), false);
  $("#apercuPanel").hidden = t.produits === 0;
}

/* --- 7. PAGE : PRODUITS ---------------------------------------------- */
function lignesProduitsFiltrees() {
  const r = etat.rechProduits.toLowerCase();
  return etat.produits.filter((p) => {
    const okRech = `${p.name} ${p.sku}`.toLowerCase().includes(r);
    const okFiltre = etat.filtreProduits === "tous" || (etat.filtreProduits === "bas" && p.stock <= p.minStock) || (etat.filtreProduits === "stock" && p.stock > p.minStock);
    return okRech && okFiltre;
  });
}

function cellModifiable(entite, id, champ, valeur, type) {
  return `<span class="modif" data-entite="${entite}" data-id="${id}" data-champ="${champ}" data-type="${type}" data-valeur="${txt(valeur)}">${txt(type === "argent" ? argent(valeur) : valeur)}</span>`;
}

function tableProduitsHTML(liste, modifiable = true) {
  if (!liste.length) return "";
  const lignes = liste.map((p) => {
    const [cls, lib] = statut(p);
    return `<tr>
      <td><div class="t-produit"><span class="box">${ico("box", true)}</span><div><strong>${modifiable ? cellModifiable("produit", p.id, "name", p.name, "texte") : txt(p.name)}</strong><em>${txt(p.sku)}</em></div></div></td>
      <td>${modifiable ? cellModifiable("produit", p.id, "minStock", p.minStock, "nombre") : p.minStock}</td>
      <td>${modifiable ? cellModifiable("produit", p.id, "initialStock", p.initialStock, "nombre") : p.initialStock}</td>
      <td class="vert">${p.entries ? "+" + p.entries : "—"}</td>
      <td class="rouge">${p.exits ? "−" + p.exits : "—"}</td>
      <td class="num">${p.stock}</td>
      <td>${modifiable ? cellModifiable("produit", p.id, "price", p.price, "argent") : argent(p.price)}</td>
      <td class="num">${argent(p.value)}</td>
      <td><span class="tag ${cls}"><i></i>${lib}</span></td>
      <td class="col-actions"><div class="actions">
        <button class="act" title="Entrée de stock" onclick="ouvrirFormulaireMouvement('entry',${p.id})">${ico("in", true)}</button>
        <button class="act" title="Sortie de stock" onclick="ouvrirFormulaireMouvement('exit',${p.id})">${ico("out", true)}</button>
        <button class="act" title="Modifier" onclick="ouvrirFormulaireProduit(${p.id})">${ico("pencil", true)}</button>
        <button class="act sup" title="Supprimer" onclick="demanderSuppression('produit',${p.id})">${ico("trash", true)}</button>
      </div></td></tr>`;
  }).join("");
  return `<thead><tr><th>${C.colonnes.designation}</th><th>${C.colonnes.stockMin}</th><th>${C.colonnes.stockInitial}</th><th>${C.colonnes.entree}</th><th>${C.colonnes.sortie}</th><th>${C.colonnes.stockFinal}</th><th>${C.colonnes.prix}</th><th>${C.colonnes.valeur}</th><th>Statut</th><th class="col-actions">Actions</th></tr></thead><tbody>${lignes}</tbody>`;
}

function dessinerProduits() {
  const liste = lignesProduitsFiltrees();
  $("#compteProduits").textContent = liste.length;
  $("#tableProduits").innerHTML = tableProduitsHTML(liste);
  const conteneur = $("#tableProduits").parentElement;
  conteneur.querySelector(".vide")?.remove();
  if (!liste.length) conteneur.insertAdjacentHTML("beforeend", tableVide(
    etat.produits.length ? "Aucun produit trouvé" : "Votre inventaire est vide",
    etat.produits.length ? "Modifiez votre recherche ou le filtre actif." : "Ajoutez votre premier produit avec le formulaire ci-dessus."));
  $("#piedProduits").innerHTML = `Affichage de <b>${liste.length}</b> ${pluriel(liste.length, "produit", "produits")} sur ${etat.produits.length}`;
  document.querySelectorAll("#filtresProduits button").forEach((b) => b.classList.toggle("active", b.dataset.filtre === etat.filtreProduits));
}

/* --- 8. PAGE : MOUVEMENTS -------------------------------------------- */
function dessinerMouvements() {
  const debut = limitePeriode(etat.periodeMouvements);
  const dansPeriode = (m) => !debut || m.date >= debut;
  const visibles = etat.mouvements.filter(dansPeriode);
  const t = totaux(etat.produits, visibles);
  const periode = PERIODES.find((p) => p.id === etat.periodeMouvements);
  const derniere = visibles[0];

  $("#statsMouvements").innerHTML =
    carte("in", "t-vert", `Entrées · ${periode.libelle.toLowerCase()}`, "+" + nb(t.entrees), t.entrees ? "Unités réceptionnées" : "Aucune entrée sur la période", { noteIcone: "in" }) +
    carte("out", "t-orange", `Sorties · ${periode.libelle.toLowerCase()}`, "−" + nb(t.sorties), t.sorties ? "Unités sorties du stock" : "Aucune sortie sur la période", { noteIcone: "out" }) +
    carte("activity", "t-bleu", "Mouvements de la période", nb(visibles.length), visibles.length ? `Sur ${etat.mouvements.length} au total` : "Aucune opération", { noteIcone: "activity" }) +
    carte("calendar", "t-violet", "Dernière opération", derniere ? jour(derniere.date) : "—", derniere ? derniere.productName : "Rien à afficher", { petit: true, noteIcone: "calendar" });

  const r = etat.rechMouvements.toLowerCase();
  const liste = visibles.filter((m) => `${m.productName} ${m.note}`.toLowerCase().includes(r) && (etat.filtreMouvements === "tous" || m.type === etat.filtreMouvements));
  $("#compteMouvements").textContent = liste.length;
  $("#sousTitreMouvements").textContent = debut
    ? (etat.periodeMouvements === "jour"
        ? `Opérations d’aujourd’hui, ${jour(debut)}.`
        : `Opérations du ${jour(debut)} au ${jour(aujourdhui())}.`)
    : "Toutes les opérations enregistrées, de la plus récente à la plus ancienne.";
  $("#tableMouvements").innerHTML = liste.length
    ? `<thead><tr><th>Date</th><th>Produit</th><th>Type</th><th>Quantité</th><th>Note</th><th class="col-actions">Actions</th></tr></thead><tbody>${liste.map((m) => `<tr>
        <td>${cellModifiable("mouvement", m.id, "date", m.date, "date")}</td>
        <td><div class="t-produit"><span class="box">${ico("box", true)}</span><strong>${txt(m.productName)}</strong></div></td>
        <td><span class="tag ${m.type === "entry" ? "tag-entree" : "tag-sortie"}">${ico(m.type === "entry" ? "in" : "out", true)} ${m.type === "entry" ? "Entrée" : "Sortie"}</span></td>
        <td class="${m.type === "entry" ? "vert" : "rouge"}">${m.type === "entry" ? "+" : "−"}${cellModifiable("mouvement", m.id, "quantity", m.quantity, "nombre")}</td>
        <td>${cellModifiable("mouvement", m.id, "note", m.note || "—", "texte")}</td>
        <td class="col-actions"><div class="actions"><button class="act sup" title="Supprimer" onclick="demanderSuppression('mouvement',${m.id})">${ico("trash", true)}</button></div></td></tr>`).join("")}</tbody>`
    : "";
  const conteneur = $("#tableMouvements").parentElement;
  conteneur.querySelector(".vide")?.remove();
  if (!liste.length) conteneur.insertAdjacentHTML("beforeend", tableVide(
    etat.mouvements.length ? "Aucun mouvement sur cette période" : "Aucun mouvement enregistré",
    etat.mouvements.length ? "Choisissez une période plus large." : "Enregistrez une entrée ou une sortie ci-dessus."));
  $("#piedMouvements").innerHTML = `Affichage de <b>${liste.length}</b> ${pluriel(liste.length, "mouvement", "mouvements")} · période ${periode.libelle.toLowerCase()}`;
  document.querySelectorAll("#filtresMouvements button").forEach((b) => b.classList.toggle("active", b.dataset.filtre === etat.filtreMouvements));
  document.querySelectorAll("#periodesMouvements button").forEach((b) => b.classList.toggle("active", b.dataset.periode === etat.periodeMouvements));
}

/* --- 9. PAGE : RÉCAPITULATIF ----------------------------------------- */
function dessinerRecap(t) {
  $("#statsRecap").innerHTML =
    carte("box", "t-bleu", "Références", nb(t.produits), t.produits ? "Produits suivis" : "Inventaire vide", { noteIcone: "box" }) +
    carte("grid", "t-vert", "Unités en stock", nb(t.unites), "Toutes références confondues") +
    carte("chart", "t-violet", "Montant du stock", argent(t.valeur), "Valeur totale calculée", { petit: true }) +
    carte("alert", "t-orange", "À réapprovisionner", nb(t.alertes), t.alertes ? "Sous le stock minimum" : "Aucun produit en alerte", { noteIcone: "alert", clic: t.alertes ? "voirAlertes()" : "" });

  const co = C.colonnes;
  $("#tableRecap").innerHTML = t.produits
    ? `<thead><tr><th>${co.designation}</th><th>${co.stockMin}</th><th>${co.stockInitial}</th><th>${co.entree}</th><th>${co.sortie}</th><th>${co.alerte}</th><th>${co.stockFinal}</th><th>${co.prix}</th><th>${co.valeur}</th></tr></thead>
    <tbody>${etat.produits.map((p) => `<tr>
      <td><strong style="color:#33484c">${txt(p.name)}</strong></td>
      <td>${p.minStock}</td><td>${p.initialStock}</td>
      <td class="vert">${p.entries || 0}</td><td class="rouge">${p.exits || 0}</td>
      <td>${p.stock <= p.minStock ? `<span class="tag tag-bas"><i></i>À commander</span>` : `<span class="tag tag-ok"><i></i>OK</span>`}</td>
      <td class="num">${p.stock}</td><td>${argent(p.price)}</td><td class="num">${argent(p.value)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="6">MONTANT DU STOCK</td><td>${nb(t.unites)}</td><td></td><td>${argent(t.valeur)}</td></tr></tfoot>`
    : "";

  const alertes = etat.produits.filter((p) => p.stock <= p.minStock);
  $("#tableAlertes").innerHTML = alertes.length
    ? `<thead><tr><th>${co.designation}</th><th>${co.stockFinal}</th><th>${co.stockMin}</th><th>Quantité à commander</th><th>Statut</th><th class="col-actions">Action</th></tr></thead>
       <tbody>${alertes.map((p) => `<tr>
         <td><strong style="color:#33484c">${txt(p.name)}</strong></td><td class="num">${p.stock}</td><td>${p.minStock}</td>
         <td class="rouge">${Math.max(p.minStock - p.stock, 1)}</td>
         <td><span class="tag ${statut(p)[0]}"><i></i>${statut(p)[1]}</span></td>
         <td class="col-actions"><button class="btn btn-entree btn-sm" onclick="ouvrirFormulaireMouvement('entry',${p.id})">${ico("in", true)} Réapprovisionner</button></td></tr>`).join("")}</tbody>`
    : "";
  const conteneur = $("#tableAlertes").parentElement;
  conteneur.querySelector(".vide")?.remove();
  if (!alertes.length) conteneur.insertAdjacentHTML("beforeend", tableVide(
    t.produits ? "Tout est en ordre" : "Aucun produit à surveiller",
    t.produits ? "Aucun produit sous le stock minimum." : "Les alertes apparaîtront après l’ajout de produits."));
}

/* --- 10. MODIFICATION DIRECTE DANS LE TABLEAU ------------------------ */
document.addEventListener("click", (e) => {
  const cel = e.target.closest(".modif");
  if (!cel || cel.dataset.edition || operationEnCours) return;
  const { type, valeur } = cel.dataset;
  cel.dataset.edition = "1";
  const champ = document.createElement("input");
  champ.className = "cell-input";
  champ.type = type === "nombre" || type === "argent" ? "number" : type === "date" ? "date" : "text";
  champ.required = cel.dataset.champ !== "note";
  if (champ.type === "number") { champ.min = cel.dataset.champ === "quantity" ? "1" : "0"; champ.step = "1"; }
  if (champ.type === "text") champ.maxLength = cel.dataset.champ === "name" ? 120 : 300;
  champ.value = valeur === "—" ? "" : valeur;
  cel.textContent = "";
  cel.appendChild(champ);
  champ.focus();
  if (champ.type === "text") champ.select();
  let annule = false;
  champ.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); champ.blur(); }
    if (ev.key === "Escape") { ev.stopPropagation(); annule = true; champ.blur(); }
  });
  champ.addEventListener("blur", () => {
    if (annule || champ.value === valeur) return dessinerTout();
    if (!champ.checkValidity()) { toast("Veuillez saisir une valeur valide.", true); return dessinerTout(); }
    enregistrerCellule(cel.dataset, champ.value);
  }, { once: true });
});

function enregistrerCellule({ entite, id, champ }, valeur) {
  const num = Number(valeur);
  if (entite === "produit") {
    const p = etat.produits.find((x) => x.id === Number(id));
    if (!p) return dessinerTout();
    const corps = { id: p.id, name: p.name, price: p.price, minStock: p.minStock, initialStock: p.initialStock };
    corps[champ] = champ === "name" ? valeur.trim() : num;
    return action(() => api("/api/products", "PATCH", corps), "Produit mis à jour.");
  }
  const m = etat.mouvements.find((x) => x.id === Number(id));
  if (!m) return dessinerTout();
  const corps = { id: m.id, quantity: m.quantity, date: m.date, note: m.note, allowNegative: C.autoriserStockNegatif };
  corps[champ] = champ === "quantity" ? num : champ === "note" ? (valeur.trim() === "—" ? "" : valeur.trim()) : valeur;
  return action(() => api("/api/movements", "PATCH", corps), "Mouvement mis à jour.");
}

/* --- 11. FORMULAIRES -------------------------------------------------- */
function remplirListesProduits() {
  const options = `<option value="">Sélectionner…</option>` + etat.produits.map((p) => `<option value="${p.id}">${txt(p.name)} — ${p.stock} en stock</option>`).join("");
  document.querySelectorAll('select[name="productId"]').forEach((s) => { const v = s.value; s.innerHTML = options; s.value = v; });
}

function lireFormProduit(f) {
  return {
    name: champForm(f, "name").value,
    price: Number(champForm(f, "price").value),
    minStock: Number(champForm(f, "minStock").value),
    initialStock: Number(champForm(f, "initialStock").value),
  };
}

function lireFormMouvement(f) {
  return {
    productId: Number(champForm(f, "productId").value),
    type: champForm(f, "type").value,
    quantity: Number(champForm(f, "quantity").value),
    date: champForm(f, "date").value,
    note: champForm(f, "note").value,
    allowNegative: C.autoriserStockNegatif,
  };
}

$("#formProduitRapide").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const ok = await action(() => api("/api/products", "POST", lireFormProduit(f)), "Produit ajouté.");
  if (ok) {
    f.reset();
    champForm(f, "minStock").value = C.seuilAlerteParDefaut;
    champForm(f, "initialStock").value = 0;
    champForm(f, "name").focus();
  }
});

$("#formMouvementRapide").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const ok = await action(() => api("/api/movements", "POST", lireFormMouvement(f)), "Mouvement enregistré.");
  if (ok) { champForm(f, "quantity").value = ""; champForm(f, "note").value = ""; }
});

function ouvrirFormulaireProduit(id) {
  const f = $("#formProduit");
  const p = etat.produits.find((x) => x.id === id);
  $("#titreModalProduit").textContent = p ? "Modifier le produit" : "Ajouter un produit";
  champForm(f, "id").value = p ? p.id : "";
  champForm(f, "name").value = p ? p.name : "";
  champForm(f, "price").value = p ? p.price : "";
  champForm(f, "minStock").value = p ? p.minStock : C.seuilAlerteParDefaut;
  champForm(f, "initialStock").value = p ? p.initialStock : 0;
  $("#modalProduit").hidden = false;
  champForm(f, "name").focus();
}

$("#formProduit").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const corps = lireFormProduit(f);
  const id = champForm(f, "id").value;
  if (id) corps.id = Number(id);
  const ok = await action(() => api("/api/products", id ? "PATCH" : "POST", corps), id ? "Produit mis à jour." : "Produit ajouté.");
  if (ok) fermerModal("modalProduit");
});

function ouvrirFormulaireMouvement(type = "entry", produitId) {
  if (!etat.produits.length) { toast("Ajoutez d’abord un produit pour enregistrer un mouvement.", true); return; }
  const f = $("#formMouvement");
  f.reset();
  choisirType(type);
  champForm(f, "date").value = aujourdhui();
  remplirListesProduits();
  if (produitId) champForm(f, "productId").value = produitId;
  $("#modalMouvement").hidden = false;
}

function choisirType(type) {
  const f = $("#formMouvement");
  champForm(f, "type").value = type;
  f.querySelectorAll(".choix-type button").forEach((b) => {
    b.classList.remove("on-e", "on-s");
    if (b.dataset.type === type) b.classList.add(type === "entry" ? "on-e" : "on-s");
  });
}
document.querySelectorAll("#formMouvement .choix-type button").forEach((b) => b.addEventListener("click", () => choisirType(b.dataset.type)));

$("#formMouvement").addEventListener("submit", async (e) => {
  e.preventDefault();
  const ok = await action(() => api("/api/movements", "POST", lireFormMouvement(e.target)), "Mouvement enregistré.");
  if (ok) fermerModal("modalMouvement");
});

/* --- 12. SUPPRESSIONS ------------------------------------------------- */
function demanderSuppression(entite, id) {
  const cible = entite === "produit" ? etat.produits.find((p) => p.id === id) : etat.mouvements.find((m) => m.id === id);
  if (!cible) return;
  $("#texteSuppression").innerHTML = entite === "produit"
    ? `Voulez-vous vraiment supprimer <b>${txt(cible.name)}</b> ? Tous ses mouvements seront également supprimés.`
    : `Voulez-vous vraiment supprimer ${cible.type === "entry" ? "l'entrée" : "la sortie"} de <b>${cible.quantity}</b> unité(s) — ${txt(cible.productName)} ?`;
  $("#modalSuppression").hidden = false;
  $("#btnConfirmerSuppression").onclick = async () => {
    const ok = await action(() => api(`/api/${entite === "produit" ? "products" : "movements"}?id=${id}`, "DELETE"), entite === "produit" ? "Produit supprimé." : "Mouvement supprimé.");
    if (ok) fermerModal("modalSuppression");
  };
}

function ouvrirVidage() {
  champForm($("#formVidage"), "confirmation").value = "";
  $("#texteVidage").textContent = modeLocal
    ? `Cette action supprime les ${etat.produits.length} produit(s) et ${etat.mouvements.length} mouvement(s) conservés dans ce navigateur. Le site en ligne ne sera pas modifié.`
    : `Cette action supprime définitivement les ${etat.produits.length} produit(s) et ${etat.mouvements.length} mouvement(s) enregistrés dans la base. Pensez à exporter un CSV ou une sauvegarde avant de continuer.`;
  $("#modalVidage").hidden = false;
  $("#btnConfirmerVidage").disabled = true;
  champForm($("#formVidage"), "confirmation").focus();
}

champForm($("#formVidage"), "confirmation").addEventListener("input", (e) => {
  $("#btnConfirmerVidage").disabled = e.target.value.trim().toUpperCase() !== "VIDER";
});

$("#formVidage").addEventListener("submit", async (e) => {
  e.preventDefault();
  const confirmation = champForm(e.target, "confirmation").value.trim().toUpperCase();
  if (confirmation !== "VIDER") return;
  const ok = await action(
    () => modeLocal ? window.StokioLocal.vider() : api("/api/reset", "POST", { confirmation }),
    "Inventaire vidé. Vous repartez de zéro.");
  if (ok) fermerModal("modalVidage");
});

/* --- 13. NAVIGATION & FENÊTRES ---------------------------------------- */
function allerA(page) {
  etat.page = page;
  basculerMenu(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
  dessinerTout();
}
function voirAlertes() { etat.filtreProduits = "bas"; allerA("produits"); }
function fermerModal(id) { $("#" + id).hidden = true; }
function basculerMenu(ouvrir) {
  $("#menu").classList.toggle("ouvert", ouvrir);
  document.querySelector(".voile")?.remove();
  if (ouvrir) {
    const voile = document.createElement("div");
    voile.className = "voile";
    voile.onclick = () => basculerMenu(false);
    document.body.appendChild(voile);
  }
}
document.querySelectorAll(".fond-modal").forEach((m) => m.addEventListener("mousedown", (e) => { if (e.target === m) m.hidden = true; }));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll(".fond-modal").forEach((m) => (m.hidden = true)); });
$("#rechercheProduits").addEventListener("input", (e) => { etat.rechProduits = e.target.value; dessinerProduits(); });
$("#rechercheMouvements").addEventListener("input", (e) => { etat.rechMouvements = e.target.value; dessinerMouvements(); });
document.querySelectorAll("#filtresProduits button").forEach((b) => b.addEventListener("click", () => { etat.filtreProduits = b.dataset.filtre; dessinerProduits(); }));
document.querySelectorAll("#filtresMouvements button").forEach((b) => b.addEventListener("click", () => { etat.filtreMouvements = b.dataset.filtre; dessinerMouvements(); }));
document.querySelectorAll("#periodesMouvements button").forEach((b) => b.addEventListener("click", () => { etat.periodeMouvements = b.dataset.periode; dessinerMouvements(); }));

/* --- 14. MESSAGES ----------------------------------------------------- */
let minuteurToast;
function toast(message, erreur) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast" + (erreur ? " err" : "");
  el.innerHTML = `${ico(erreur ? "alert" : "check", true)} <span>${txt(message)}</span>`;
  document.body.appendChild(el);
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => el.remove(), 4000);
}

/* --- 15. EXPORT EXCEL (CSV) ------------------------------------------- */
function exporterCSV() {
  const co = C.colonnes;
  const t = totaux();
  const entetes = [co.designation, "Référence", co.stockMin, co.stockInitial, co.entree, co.sortie, co.stockFinal, `${co.prix} (${C.devise})`, `${co.valeur} (${C.devise})`, co.alerte];
  const lignes = etat.produits.map((p) => [p.name, p.sku, p.minStock, p.initialStock, p.entries, p.exits, p.stock, p.price, p.value, p.stock <= p.minStock ? "À commander" : "OK"]);
  lignes.push([], ["MONTANT DU STOCK", "", "", "", t.entrees, t.sorties, t.unites, "", t.valeur, ""]);
  lignes.push([], ["HISTORIQUE DES MOUVEMENTS"], ["Date", "Produit", "Type", "Quantité", "Note"]);
  etat.mouvements.forEach((m) => lignes.push([m.date, m.productName, m.type === "entry" ? "Entrée" : "Sortie", m.quantity, m.note]));
  telechargerFichier("\uFEFF" + [entetes, ...lignes].map((l) => l.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n"), `inventaire-${aujourdhui()}.csv`, "text/csv;charset=utf-8");
  toast("Inventaire exporté au format CSV.");
}

function telechargerFichier(contenu, nom, type) {
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 10000);
}

/* --- 16. SAUVEGARDE DU MODE LOCAL ------------------------------------ */
function sauvegarderLocal() {
  try {
    telechargerFichier(JSON.stringify(window.StokioLocal.sauvegarde(), null, 2), `sauvegarde-stokio-${aujourdhui()}.json`, "application/json");
    toast("Sauvegarde téléchargée. Conservez ce fichier dans un endroit sûr.");
  } catch (e) { toast(e.message, true); }
}

$("#restaurerFichier").addEventListener("change", async (e) => {
  const fichier = e.target.files[0];
  if (!fichier || !modeLocal) return;
  try {
    if (fichier.size > 20 * 1024 * 1024) throw new Error("Le fichier de sauvegarde dépasse 20 Mo.");
    const source = JSON.parse(await fichier.text());
    if (!window.confirm("Restaurer cette sauvegarde remplacera l’inventaire local actuel. Sauvegardez-le d’abord si nécessaire. Continuer ?")) return;
    window.StokioLocal.restaurer(source);
    await charger();
    toast("Sauvegarde restaurée. Le site en ligne n’a pas été modifié.");
  } catch (e) {
    toast(e instanceof SyntaxError ? "Le fichier n’est pas une sauvegarde JSON valide." : e.message, true);
  } finally { e.target.value = ""; }
});

/* --- 17. DÉMARRAGE ---------------------------------------------------- */
function afficherErreurChargement(e) {
  $("#erreurChargement").textContent = e.message;
  $("#erreurChargement").hidden = false;
  $("#etatStockage").textContent = "Inventaire indisponible · consultez le message ci-dessus";
}

appliquerConfig();
dessinerTout();
charger().catch(afficherErreurChargement);
window.addEventListener("inventaire-local-modifie", () => charger().catch(afficherErreurChargement));
