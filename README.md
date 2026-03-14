# 📚 Élève Tracker

Suivi des sessions de cours — saisie des heures de début/fin et calcul automatique de la durée.

## Stack

- **Nuxt 3** — framework Vue
- **Nuxt UI** — composants UI
- **Supabase** — base de données (projet : EleveTracker)

## Installation

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

L'app sera disponible sur http://localhost:3000

## Structure de la BDD

Table `sessions` sur Supabase :

| Colonne | Type | Description |
|---|---|---|
| id | uuid | Clé primaire auto |
| eleve_prenom | text | Prénom de l'élève |
| eleve_nom | text | Nom de l'élève |
| date | date | Date de la session |
| heure_debut | time | Heure de début (HH:MM:SS) |
| heure_fin | time | Heure de fin (HH:MM:SS) |
| duree_secondes | integer | **Calculé automatiquement** par Postgres |
| notes | text | Notes optionnelles |
| created_at | timestamptz | Date de création |

## Variables d'environnement

Copier `.env.example` vers `.env` et remplir les valeurs :

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your_anon_key
```
