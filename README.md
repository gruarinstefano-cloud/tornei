# Tornei di Calcio

Applicazione web per la gestione e pubblicazione di tornei di calcio.

## Funzionalità

- **Multi-torneo**: gestisci più tornei contemporaneamente da un unico backend
- **Multi-admin**: ogni admin gestisce i propri tornei in autonomia
- **Pubblico**: ogni torneo ha un URL dedicato visibile da tutti
- **Tipi**: gironi + eliminazione, oppure campionato + eliminazione
- **Programma campi**: partite organizzate per campo con orari
- **Tabellone**: fase eliminatoria con visualizzazione bracket
- **Personalizzazione**: colori, logo società, sponsor

## Stack tecnico

- **Next.js 14** (App Router)
- **Supabase** (database + autenticazione)
- **Tailwind CSS**
- **Vercel** (hosting)

## Setup

Leggi `GUIDA_INSTALLAZIONE.md` per le istruzioni complete.

## Struttura

```
src/
  app/
    page.tsx              # Homepage — lista tornei
    torneo/[slug]/        # Pagina pubblica torneo
    admin/
      page.tsx            # Login admin
      dashboard/          # Lista tornei dell'admin
      torneo/[id]/        # Gestione singolo torneo
  lib/
    supabase.ts           # Client Supabase
    types.ts              # Tipi TypeScript + utility
supabase/
  schema.sql              # Schema database
```
