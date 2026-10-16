/* =========================================================================
   FICHIER DE CONFIGURATION — MODIFIABLE PAR L'ADMINISTRATEUR
   -------------------------------------------------------------------------
   Vous pouvez changer librement les valeurs entre guillemets ou entre chiffres.
   Ne supprimez pas les virgules ni les accolades.
   Après modification : enregistrez le fichier puis rafraîchissez dashboard.html (F5).
   Conservez tous les fichiers du dossier public ensemble, ou utilisez
   dashboard-autonome.html (qui contient ses propres styles et scripts).
   Le mode local est automatique par double-clic : données dans le navigateur,
   indépendantes de la base du site. Voir LIRE-MOI.txt pour les sauvegardes.
   ========================================================================= */

window.CONFIG = {

  /* --- 1. IDENTITÉ DE L'ENTREPRISE ------------------------------------- */
  nomEntreprise: "stokio",          // Nom affiché en haut à gauche
  sousTitre: "GESTION DE STOCK",    // Petite ligne sous le nom
  nomAdmin: "Administrateur",       // Nom de l'utilisateur connecté
  roleAdmin: "Gestionnaire de stock",
  nomEspace: "Inventaire principal", // Nom de l'espace de travail

  /* --- 2. MONNAIE ------------------------------------------------------ */
  devise: "F CFA",                  // Ex : "F CFA", "€", "$"
  deviseAvantMontant: false,        // true => "$ 1 000"  |  false => "1 000 F CFA"

  /* --- 3. RÈGLES DE GESTION -------------------------------------------- */
  seuilAlerteParDefaut: 5,          // Stock minimum proposé pour un nouveau produit
  autoriserStockNegatif: false,     // true = autorise les sorties supérieures au stock
  joursGraphique: 7,                // Nombre de jours affichés dans le graphique

  /* --- 4. COULEURS DU SITE --------------------------------------------- */
  couleurs: {
    principale: "#168b74",          // Couleur des boutons principaux
    menu: "#102b30",                // Fond du menu de gauche
    entree: "#1f9a73",              // Couleur des entrées de stock
    sortie: "#d9735f",              // Couleur des sorties de stock
    alerte: "#e0954f",              // Couleur des alertes de stock
    fond: "#f7f9f8",                // Fond général des pages
  },

  /* --- 5. TEXTES DES MENUS --------------------------------------------- */
  menus: {
    dashboard: "Vue d'ensemble",
    produits: "Produits",
    mouvements: "Mouvements",
    recap: "Récapitulatif",
  },

  /* --- 6. COLONNES DU RÉCAPITULATIF (comme dans le fichier Excel) ------- */
  colonnes: {
    designation: "Désignation",
    stockMin: "Stock min",
    stockInitial: "Stock initial",
    entree: "Entrée",
    sortie: "Sortie",
    alerte: "Alerte stock",
    stockFinal: "Stock final",
    prix: "P.U",
    valeur: "Valeur du stock",
  },
};
