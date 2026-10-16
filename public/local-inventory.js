/* =========================================================================
   INVENTAIRE LOCAL — ouverture par double-clic, sans serveur
   En ligne, les données restent gérées par l'API et PostgreSQL.
   En mode local, elles sont conservées dans le navigateur (localStorage).
   Les deux inventaires sont indépendants : aucune synchronisation implicite.
   ========================================================================= */
window.StokioLocal = (() => {
  const actif = location.protocol === "file:" || window.MODE_AUTONOME === true;
  const cle = "stokio.inventaire.local.v1:" + (window.INVENTAIRE_ID || location.pathname);
  const copier = (valeur) => JSON.parse(JSON.stringify(valeur));
  let memoire;

  // Références et valeurs visibles dans le classeur fourni.
  const references = [
    ["Pinncle de 5", 50000, 0], ["Pinncle de 4", 35000, 5],
    ["Pinncle de 3", 20000, 5], ["La main", 42000, 0],
    ["Tropicana", 38000, 0], ["Royal", 36000, 0],
    ["Royal de 2", 32000, 0], ["Ceremonial", 35000, 0],
    ["Maxwell", 28000, 0], ["Amazone", 0, 0], ["Le monde", 0, 0],
    ["Cutie", 32000, 0], ["Summer", 16000, 0],
    ["Ploplo grand", 19000, 0], ["Ploplo petit", 14000, 0],
    ["Beauty", 14000, 0], ["Eskimo de 2", 3500, 0],
    ["Caraf", 3000, 0], ["Passoir plastique", 700, 0],
    ["Plat plastique", 150, 0], ["Bol plastique", 300, 0],
    ["Gobelet plastique", 1000, 0], ["Boîte à épice", 1000, 0],
    ["Germany de 8", 40500, 4],
  ];

  function dateLocale() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function donneesInitiales() {
    if (window.INVENTAIRE_INITIAL) return verifierSauvegarde(window.INVENTAIRE_INITIAL);
    const createdAt = new Date().toISOString();
    const products = references.map(([name, price], i) => ({
      id: i + 1, name, price, sku: `PRD-${String(i + 1).padStart(3, "0")}`,
      minStock: 0, initialStock: 0, createdAt,
    }));
    const movements = references.flatMap(([, , quantity], i) => quantity ? [{
      id: i + 1, productId: i + 1, type: "entry", quantity, date: dateLocale(),
      note: "Reprise du classeur Excel (date d’import local)", createdAt,
    }] : []);
    return { products, movements };
  }

  function entier(valeur, minimum = 0) {
    const n = Number(valeur);
    if (valeur === "" || valeur === null || !Number.isSafeInteger(n) || n < minimum || n > 2147483647) {
      throw new Error(`Veuillez saisir un nombre entier supérieur ou égal à ${minimum}.`);
    }
    return n;
  }

  function produitValide(corps) {
    const name = String(corps.name ?? "").trim();
    if (!name || name.length > 120) throw new Error("La désignation doit contenir entre 1 et 120 caractères.");
    return { name, price: entier(corps.price), minStock: entier(corps.minStock), initialStock: entier(corps.initialStock) };
  }

  function mouvementValide(corps) {
    const date = String(corps.date ?? "");
    const note = String(corps.note ?? "").trim();
    const d = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
      throw new Error("Veuillez saisir une date valide.");
    }
    if (note.length > 300) throw new Error("La note ne peut pas dépasser 300 caractères.");
    return { quantity: entier(corps.quantity, 1), date, note };
  }

  function verifierSauvegarde(source) {
    if (!source || !Array.isArray(source.products) || !Array.isArray(source.movements)) {
      throw new Error("Ce fichier n’est pas une sauvegarde d’inventaire valide.");
    }
    const ids = new Set();
    const skus = new Set();
    const products = source.products.map(p => {
      const id = entier(p.id, 1);
      const sku = String(p.sku || `PRD-${id}`);
      if (ids.has(id) || skus.has(sku) || sku.length > 100) throw new Error("La sauvegarde contient des références en double ou invalides.");
      ids.add(id); skus.add(sku);
      return { id, sku, ...produitValide(p), createdAt: String(p.createdAt || new Date().toISOString()) };
    });
    const idsMouvements = new Set();
    const movements = source.movements.map(m => {
      const id = entier(m.id, 1);
      const productId = entier(m.productId, 1);
      if (!ids.has(productId) || idsMouvements.has(id) || !["entry", "exit"].includes(m.type)) {
        throw new Error("La sauvegarde contient un mouvement invalide ou un produit manquant.");
      }
      idsMouvements.add(id);
      return { id, productId, type: m.type, ...mouvementValide(m), createdAt: String(m.createdAt || new Date().toISOString()) };
    });
    return { products, movements };
  }

  function lire() {
    if (memoire) return memoire;
    let contenu;
    try {
      contenu = localStorage.getItem(cle);
    } catch {
      throw new Error("Le navigateur bloque le stockage local. Ouvrez ce fichier dans Chrome ou Edge en navigation normale, et autorisez le stockage du navigateur.");
    }
    if (contenu !== null) {
      try { memoire = verifierSauvegarde(JSON.parse(contenu)); }
      catch { throw new Error("La sauvegarde du navigateur est illisible. Restaurez un fichier JSON valide ; aucune donnée n’a été écrasée."); }
    } else {
      memoire = donneesInitiales();
      // Une liste vide déjà enregistrée ne sera jamais remplacée par les exemples.
    }
    return memoire;
  }

  function enregistrer(donnees) {
    try { localStorage.setItem(cle, JSON.stringify(donnees)); }
    catch { throw new Error("Enregistrement impossible : stockage du navigateur bloqué ou plein. La modification n’a pas été enregistrée. Sauvegardez vos données avant de continuer."); }
    memoire = donnees;
  }

  function calculer(donnees) {
    const noms = new Map(donnees.products.map(p => [p.id, p.name]));
    const products = donnees.products.map(p => {
      const liste = donnees.movements.filter(m => m.productId === p.id);
      const entries = liste.filter(m => m.type === "entry").reduce((s, m) => s + m.quantity, 0);
      const exits = liste.filter(m => m.type === "exit").reduce((s, m) => s + m.quantity, 0);
      const stock = p.initialStock + entries - exits;
      return { ...p, entries, exits, stock, value: stock * p.price };
    });
    const movements = donnees.movements.map(m => ({ ...m, productName: noms.get(m.productId) }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    return { products, movements };
  }

  function verifierStock(donnees, productId) {
    const produit = calculer(donnees).products.find(p => p.id === productId);
    if (!window.CONFIG.autoriserStockNegatif && produit && produit.stock < 0) {
      throw new Error("Stock insuffisant : cette opération rendrait le stock négatif. Corrigez d’abord les sorties concernées.");
    }
  }

  function prochainId(liste) {
    return liste.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  }

  async function requete(adresse, methode = "GET", corps = {}) {
    const url = new URL(adresse, "https://inventaire.local");
    if (url.pathname === "/api/inventory" && methode === "GET") return calculer(lire());
    const donnees = copier(lire());
    const id = Number(url.searchParams.get("id") || corps.id);
    let resultat;

    if (url.pathname === "/api/products") {
      const index = donnees.products.findIndex(p => p.id === id);
      if (methode === "POST") {
        const nouveauId = prochainId(donnees.products);
        resultat = { ...produitValide(corps), id: nouveauId, sku: `LOC-${Date.now().toString(36).toUpperCase()}-${nouveauId}`, createdAt: new Date().toISOString() };
        donnees.products.push(resultat);
      } else {
        if (index < 0) throw new Error("Produit introuvable.");
        if (methode === "PATCH") {
          resultat = { ...donnees.products[index], ...produitValide(corps) };
          donnees.products[index] = resultat;
          verifierStock(donnees, id);
        } else if (methode === "DELETE") {
          donnees.products.splice(index, 1);
          donnees.movements = donnees.movements.filter(m => m.productId !== id);
          resultat = { success: true };
        }
      }
    } else if (url.pathname === "/api/movements") {
      if (methode === "POST") {
        const productId = entier(corps.productId, 1);
        if (!donnees.products.some(p => p.id === productId)) throw new Error("Veuillez sélectionner un produit.");
        if (!["entry", "exit"].includes(corps.type)) throw new Error("Type de mouvement invalide.");
        resultat = { ...mouvementValide(corps), id: prochainId(donnees.movements), productId, type: corps.type, createdAt: new Date().toISOString() };
        donnees.movements.push(resultat);
        verifierStock(donnees, productId);
      } else {
        const index = donnees.movements.findIndex(m => m.id === id);
        if (index < 0) throw new Error("Mouvement introuvable.");
        const productId = donnees.movements[index].productId;
        if (methode === "PATCH") {
          resultat = { ...donnees.movements[index], ...mouvementValide(corps) };
          donnees.movements[index] = resultat;
        } else if (methode === "DELETE") {
          donnees.movements.splice(index, 1);
          resultat = { success: true };
        }
        verifierStock(donnees, productId);
      }
    }
    if (!resultat) throw new Error("Opération non prise en charge.");
    enregistrer(donnees);
    return resultat;
  }

  function sauvegarde() {
    return { application: "stokio", version: 1, exportedAt: new Date().toISOString(), ...copier(lire()) };
  }

  function restaurer(source) {
    // Valide tout le fichier avant de remplacer quoi que ce soit.
    const donnees = verifierSauvegarde(source);
    enregistrer(donnees);
  }

  // Repart d'un inventaire vide, sans réimporter les exemples ensuite.
  function vider() {
    enregistrer({ products: [], movements: [] });
    return { products: 0, movements: 0 };
  }

  window.addEventListener("storage", (e) => {
    if (actif && e.key === cle) { memoire = undefined; window.dispatchEvent(new Event("inventaire-local-modifie")); }
  });

  return { actif, requete, sauvegarde, restaurer, vider };
})();
