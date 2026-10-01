// lib/schemas/user.ts
//
// Schéma email partagé pour les comptes staff (User). La colonne `email` est
// en `citext` (insensible à la casse côté base — voir prisma/schema.prisma),
// mais on normalise aussi à l'écriture pour que la liste des comptes
// (dashboard/utilisateurs) n'affiche jamais deux casses différentes du même
// email. Conformément à CLAUDE.md : pas de redéclaration inline ailleurs.

import { z } from 'zod';

export const userEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email invalide');
