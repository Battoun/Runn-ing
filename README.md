# Runn-ing

Tableau de bord running perso : perfs, séances Strava, calendrier d'entraînement, courses à venir et outils.

## Démarrer

```bash
npm install
npm run dev          # http://localhost:3000
```

Créer / réinitialiser un compte :

```bash
npm run seed -- <login> <motdepasse>                    # crée ou met à jour le mot de passe
npm run seed -- <login> <motdepasse> --with-examples    # + exemples de courses et séances
```

Seul le hash bcrypt du mot de passe est stocké (dans `data/db.json`).

## Brancher Strava

1. Créer une app sur https://www.strava.com/settings/api — *Authorization Callback Domain* : `localhost`
2. Renseigner `STRAVA_CLIENT_ID` et `STRAVA_CLIENT_SECRET` dans `.env.local`
3. Redémarrer, puis **Paramètres → Se connecter avec Strava**

Tant que Strava n'est pas connecté, le site affiche des données de démo.

## Pages

| Page | Contenu |
|---|---|
| Tableau de bord | km semaine/mois/année, objectif hebdo, charge 7 j / 28 j, prochaine course (J-x, prédiction), météo + meilleur créneau, graphiques volume & allure, séances à venir, dernières sorties, meilleures allures |
| Calendrier | vue mois, séances planifiées par type, sorties réalisées, courses, total par semaine, glisser-déposer, répétition hebdo, cocher « faite » |
| Activités | historique filtrable (période, recherche) avec totaux |
| Courses | objectifs à venir (allure cible, prédiction vs objectif), historique et résultats |
| Outils | allure, prédicteur Riegel, zones VMA, zones FC (Karvonen), plan de passage, allure ↔ km/h |
| Paramètres | Strava, profil (objectif hebdo, VMA, FC, ville météo), mot de passe |

## Technique

Next.js 15 (App Router) · TypeScript 5 · Tailwind 4 · Recharts · session JWT (cookie httpOnly) · stockage JSON local (`data/db.json`, gitignoré).
Pour un déploiement (Vercel…), remplacer `src/lib/db.ts` par une vraie base (Supabase, Postgres…) car le système de fichiers n'y est pas persistant.
