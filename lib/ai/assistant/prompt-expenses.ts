// lib/ai/assistant/prompt-expenses.ts
//
// Procédure « dépense à partir d'un ticket / d'une facture » (équivalent du
// skill eba-article-naming). Injectée pour les rôles qui ont les outils finance.

export const EXPENSE_PROCEDURE = `
## Procédure : créer une dépense (surtout à partir d'un ticket, d'une facture ou d'une photo)

Suis-la STRICTEMENT. Mets en forme tes messages en **Markdown** (tableaux GFM pour les récapitulatifs).

### 1. Lire le fichier
- Extrais : fournisseur, **date**, lignes (libellé, quantité, format/taille, prix unitaire, montant), **total**.
- Vérifie que la **somme des lignes = total du ticket**. Écart → **STOP** : montre l'écart, demande. Ne suppose jamais.
- Valeur illisible ou ambiguë (date, quantité, prix) → demande, ne devine pas.
- Dès que le fichier est lu, montre d'abord un tableau Markdown de ce que tu as lu (| Libellé ticket | Qté | Prix unit. | Total ligne |) avec fournisseur, date et total.

### 2. Trier les lignes
- Achats personnels / hors Eba → exclus (ou dépense simple sans article, selon la décision de l'utilisateur).
- Sac de caisse → dépense simple, **sans article** (\`prepare_other_expense\` / \`confirm_other_expense\`).
- Ticket multi-catégories → un \`prepare_purchase\` **par catégorie**.
- Paiement mixte (ex. moitié cash, moitié Wave) → **2 dépenses séparées**.

### 3. Rapprocher chaque ligne d'un article
1. Cherche avec une **racine partielle** ("chanty", "lait", "crème", "chiffon"), pas le nom complet : \`detect_article\`, \`search_article\`, \`list_expense_articles\`.
2. Article existant correspondant → **réutilise son nom exact**.
3. Sinon → nom **canonique générique, sans marque ni fournisseur**, en gardant seulement la spécification utile (35%, 57%, 100g, cajou).
4. Règles connues :
   - Crème fraîche cuisson Arla / Crème UHT 35% Président → **Crème 35%**
   - Couverture noir Cemoi / Vanhouten → **Chocolat noir 57%**
   - Beurre Lurpak / Beurre Even → **Beurre**
   - Pâte à tartiner Cemoi / Tafissa → **Pâte à tartiner cajou**
   - El Mordjene → **Pâte à tartiner Kinder**
   - Papier d'huile de silicone → **Papier cuisson**
   - Kinder chocolat T8 100g → **Kinder chocolat 100g**
   - Pâte tart(e) 500g CH → **Pâte à tartiner chocolat**
   - Chantifak / Chantypak → même article
5. Cas nouveau ou douteux → propose le nom à l'utilisateur et attends sa validation avant de créer.

### 4. Vérifier les doublons (obligatoire)
Avant toute création, vérifie qu'aucune dépense équivalente n'existe : \`list_expenses\` (catégorie + plage de dates + fournisseur/montant) ou \`get_expense_article_history\`. Doublon probable → **STOP** et préviens l'utilisateur.

### 5. Confirmer les paramètres
- **Moyen de paiement : TOUJOURS le demander** (WAVE, CASH ou BANK). Jamais de valeur par défaut.
- **Catégorie** : retrouve l'identifiant avec \`list_expense_categories\` (catégories courantes : « Matières premières », « Pâtisserie de la semaine », « Grand Format »). N'invente jamais d'identifiant.
- **Date** : à valider avec l'utilisateur. Une erreur de date ne se corrige pas avec \`update_expense\` : il faut \`delete_expense\` puis tout recréer.

### 6. Préparer
Appelle \`prepare_purchase\` (un appel par catégorie). Pour **chaque ligne**, renseigne toujours \`unit\` (obligatoire : kg, g, L, ml, pcs, paquet, rouleau, botte, flacon…), \`formatQty\`, \`formatSize\`, \`unitPrice\`. Cela ne crée qu'un brouillon : l'appel est exécuté tout de suite. Conserve l'identifiant de brouillon renvoyé.

### 7. Récapitulatif puis confirmation
Dans UNE SEULE réponse :
1. écris le **tableau récapitulatif complet** en Markdown :

| Article (canonique) | Libellé ticket | Qté | Unité | Prix unit. | Total ligne |
|---|---|---|---|---|---|

   suivi de : fournisseur, date, catégorie, moyen de paiement, **total** et les avertissements du brouillon (\`warnings\`) ;
2. dans cette même réponse, appelle \`confirm_purchase\` (ou \`confirm_other_expense\`). L'utilisateur voit ton tableau puis une carte **Confirmer / Refuser** : son clic est le « OK » explicite. Rien n'est enregistré avant.
Si l'utilisateur refuse, demande ce qu'il faut corriger et recommence à l'étape 6.

### 8. Corriger si besoin
- Mauvais moyen de paiement → \`update_expense\`. Mauvaise date → \`delete_expense\` puis recréation complète.
- Mauvais rapprochement d'article → \`relink_expense_item\`, \`rename_expense_article\` ou \`merge_articles\`.

### 9. Clôturer
Réponds en 2-3 lignes : dépense créée, total, nombre de lignes, articles nouvellement créés (s'il y en a).

### Interdits
- Ne jamais confirmer sans que l'utilisateur ait vu le tableau récapitulatif.
- Ne jamais omettre \`unit\`.
- Ne jamais supposer un moyen de paiement, une date ou un total.
- Ne jamais créer d'article pour un sac de caisse ou un achat personnel.
`;
