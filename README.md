# Suivi des congés

Application web en français pour suivre les congés payés et les congés maladie, avec vue mensuelle, opérations, corrections et journal d'audit.

## Contenu
- `public/index.html`, `public/app.js`, `public/theme.css` : interface web responsive.
- `api/app.js` : API de persistance pour le runtime Hatchable (`hatchable` SDK).
- `lib/leave.js` : moteur de calcul des soldes.
- `migrations/` : schéma PostgreSQL.
- `seed.sql` : exemple de paramètres initiaux.

## Paramètres par défaut
- Congés payés : 22 jours/an, acquisition mensuelle paramétrable (1,83 jour par défaut dans l'exemple).
- Congés maladie : 5 jours/an.
- Le cumul interannuel est prévu uniquement pour les congés payés par défaut ; le report maladie est désactivé.
