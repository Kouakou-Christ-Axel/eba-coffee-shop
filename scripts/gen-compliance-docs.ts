// scripts/gen-compliance-docs.ts
//
// Génère docs/conformite/{registre-traitements,sous-traitants-et-transferts}.md
// depuis config/data-protection.ts (source unique, la même que la politique de
// confidentialité et la purge). Usage : pnpm exec tsx scripts/gen-compliance-docs.ts (depuis la racine)

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROCESSING_ACTIVITIES, PROCESSORS } from '../config/data-protection';

const DIR = join(process.cwd(), 'docs', 'conformite');
const HEADER =
  '<!-- Généré par scripts/gen-compliance-docs.ts depuis config/data-protection.ts — ne pas éditer à la main. -->\n\n';

const registre =
  HEADER +
  `# Registre des traitements de données personnelles

Base du dossier de déclaration ou d'autorisation à l'ARTCI (loi n°2013-450 du
19 juin 2013). Un traitement par fiche.

` +
  PROCESSING_ACTIVITIES.map(
    (a) => `## ${a.label}

- **Finalité** : ${a.purpose}
- **Base** : ${a.basis}
- **Données** : ${a.data}
- **Personnes concernées** : ${a.people}
- **Destinataires** : ${a.recipients}
- **Durée de conservation** : ${a.duration}
`
  ).join('\n');

const transferts =
  HEADER +
  `# Sous-traitants et transferts hors Côte d'Ivoire

À joindre à la demande d'autorisation de transfert auprès de l'ARTCI. La colonne
« Contrat » est à compléter par l'exploitant (accord de traitement de données).

| Prestataire | Rôle | Pays | Déclenchement | Contrat |
|---|---|---|---|---|
` +
  PROCESSORS.map(
    (p) =>
      `| ${p.name} | ${p.role} | ${p.country} | ${p.trigger} | à compléter |`
  ).join('\n') +
  '\n';

writeFileSync(join(DIR, 'registre-traitements.md'), registre);
writeFileSync(join(DIR, 'sous-traitants-et-transferts.md'), transferts);
console.log('docs/conformite régénéré');
