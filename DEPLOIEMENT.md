# Déployer l’inventaire sur Vercel

## Ce qui a été corrigé

Votre déploiement échouait avec :

```
ENOENT: no such file or directory, open '/vercel/path1/public/fonts/dm-sans.woff2'
```

**Cause** : les deux fichiers de police `.woff2` n’étaient pas présents dans le dossier que vous
avez envoyé à Vercel, et la compilation les lisait obligatoirement pour construire
`dashboard-autonome.html`.

**Correctif appliqué** : ces polices sont devenues **facultatives**.
- Si les fichiers sont présents → elles sont intégrées dans la version autonome (rendu identique).
- Si elles sont absentes → la compilation continue et le texte s’affiche avec la police de secours
  du navigateur. **Le déploiement ne peut plus échouer pour cette raison.**

Vérifié en retirant volontairement les polices : `npm run build` réussit.

---

## Étape 1 — Envoyer le bon dossier

Le projet doit être complet. Deux méthodes possibles.

### Méthode A : via GitHub (recommandé)

1. Créez un dépôt sur GitHub.
2. Envoyez **tout** le projet, sauf `node_modules` et `.next`.
   Vérifiez surtout que `public/fonts/` contient bien les 4 fichiers :
   `dm-sans.woff2`, `plus-jakarta-sans.woff2`, `DM-Sans-LICENSE.txt`, `Plus-Jakarta-Sans-LICENSE.txt`.
3. Sur Vercel : **Add New… → Project → Import** votre dépôt.
4. Framework Preset : **Next.js** (déjà détecté). Laissez les commandes par défaut :
   - Build Command : `npm run build`
   - Output Directory : laissé vide (`.next`)
   - Install Command : `npm install`
5. **Ne déployez pas encore** : passez à l’étape 2.

### Méthode B : glisser-déposer

Le glisser-déposer depuis le navigateur peut **perdre les fichiers binaires** (`.woff2`),
ce qui est très probablement ce qui vous est arrivé. Si vous utilisez cette méthode,
contrôlez après l’envoi que `public/fonts/*.woff2` existe. Même en leur absence,
le déploiement fonctionne désormais, mais la version autonome utilisera une police standard.

> Retirez aussi l’archive `gestion d’inventaire-tableau de bord-développement (2).zip`
> présente à la racine de votre projet : elle n’a rien à faire dans un déploiement.

---

## Étape 2 — Relier une base PostgreSQL (obligatoire)

Le site fonctionne sans base, mais **rien ne sera enregistré**. Pour que les produits,
entrées et sorties soient conservés, il faut une base PostgreSQL accessible depuis Internet.

Trois options simples :

| Service | Ce qu’il faut faire |
|---|---|
| **Neon** (gratuit) | Créez un projet, copiez la « Connection string » (`postgresql://…?sslmode=require`) |
| **Vercel Postgres** | Onglet **Storage** de votre projet → **Create Database** → la variable est ajoutée automatiquement |
| **Supabase** | Project Settings → Database → Connection string (mode « Session » ou « Transaction ») |

Dans Vercel : **Settings → Environment Variables**

| Name | Value |
|---|---|
| `DATABASE_URL` | `postgresql://utilisateur:mot_de_passe@hôte/base?sslmode=require` |

Cochez **Production**, **Preview** et **Development**, puis **Save**.

⚠️ Après toute modification de variable, il faut **redéployer**.

---

## Étape 3 — Créer les tables

Les tables ne sont pas créées automatiquement par Vercel. Depuis votre ordinateur,
une seule fois, pointez vers la base de production :

```bash
npm install
```

Créez un fichier `.env` à la racine avec l’adresse de production :

```
DATABASE_URL=postgresql://utilisateur:mot_de_passe@hôte/base?sslmode=require
```

Puis :

```bash
npx drizzle-kit push
```

Répondez éventuellement « yes » à la confirmation. Vous pouvez vérifier avec :

```bash
curl https://votre-projet.vercel.app/api/health
```

Réponse attendue :

```json
{ "ok": true, "application": "stokio", "database": "connectée", "cible": "…/app_db" }
```

---

## Étape 4 — Déployer

Cliquez sur **Deploy**. La compilation dure environ une minute.

Contrôles utiles après le déploiement :

| URL | Résultat attendu |
|---|---|
| `/` | Le tableau de bord s’affiche, avec « Votre inventaire est vide » |
| `/api/health` | `"ok": true` et `"database": "connectée"` |
| `/api/inventory` | `{"products":[],"movements":[]}` |
| `/api/download` | Télécharge `dashboard-autonome.html` |

---

## Si la page s’affiche mais qu’aucune donnée ne s’enregistre

L’interface affiche alors un message explicite en rouge. Deux cas :

1. **« Base de données non configurée »** → la variable `DATABASE_URL` manque : étape 2.
2. **« Les tables d’inventaire n’existent pas encore »** → étape 3 (`npx drizzle-kit push`).

---

## Les deux modes de l’application

| | Site hébergé (Vercel) | `dashboard-autonome.html` |
|---|---|---|
| Ouverture | URL Vercel | Double-clic sur le fichier |
| Enregistrement | PostgreSQL | Navigateur (localStorage) |
| Partage entre personnes | Oui | Non, propre à chaque poste |
| Bandeau affiché | « Données enregistrées dans la base » | « Version locale · sans serveur » |

Le téléchargement de la version hors ligne se fait depuis le menu de gauche, avec une copie
de l’inventaire du moment. Les deux modes restent **indépendants** : aucune synchronisation
automatique dans un sens ni dans l’autre.

## Personnaliser après déploiement

Modifiez `public/config.js` (nom de l’entreprise, devise, couleurs, libellés) puis redéployez.
Les couleurs se règlent aussi dans `public/styles.css`, bloc `:root`.
