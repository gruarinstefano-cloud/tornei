# Guida all'installazione — Tornei di Calcio

## Panoramica

Questa applicazione è composta da:
- **Next.js** — il framework che gestisce il sito web
- **Supabase** — il database online gratuito
- **Vercel** — l'hosting gratuito dove vive il sito

---

## PASSO 1 — Crea un account GitHub

1. Vai su **https://github.com** e clicca su "Sign up"
2. Inserisci email, password e scegli un username
3. Conferma l'email

---

## PASSO 2 — Carica il codice su GitHub

1. Una volta loggato, clicca su **"New repository"** (pulsante verde)
2. Nome repository: `tornei-calcio`
3. Lascia tutto il resto di default → **"Create repository"**
4. Nella pagina del repo vuoto, clicca su **"uploading an existing file"**
5. Carica tutti i file di questa cartella (drag & drop)
6. Clicca **"Commit changes"**

---

## PASSO 3 — Crea un account Supabase e il database

1. Vai su **https://supabase.com** → "Start your project" → Signup con GitHub
2. Clicca **"New project"**
   - Nome: `tornei-calcio`
   - Password database: scegli una password sicura e **annotala**
   - Regione: `West EU (Ireland)`
3. Attendi 1-2 minuti che il progetto si avvii
4. Nel menu a sinistra clicca su **"SQL Editor"**
5. Clicca su **"New query"**
6. Copia e incolla tutto il contenuto del file `supabase/schema.sql`
7. Clicca **"Run"** — vedrai "Success"

### Recupera le credenziali Supabase

1. Nel menu a sinistra clicca **"Settings"** → **"API"**
2. Copia:
   - **Project URL** (es. `https://abcdefgh.supabase.co`)
   - **anon public key** (stringa lunga che inizia con `eyJ...`)

---

## PASSO 4 — Pubblica su Vercel

1. Vai su **https://vercel.com** → "Sign up" → accedi con GitHub
2. Clicca **"Add New Project"**
3. Seleziona il repository `tornei-calcio` → **"Import"**
4. Prima di cliccare Deploy, apri la sezione **"Environment Variables"**
5. Aggiungi queste due variabili:

| Nome | Valore |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Il tuo Project URL di Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Il tuo anon public key di Supabase |

6. Clicca **"Deploy"** — attendi 2-3 minuti
7. Vercel ti darà un indirizzo come `tornei-calcio.vercel.app` 🎉

---

## PASSO 5 — Configura l'autenticazione Supabase

1. Vai su Supabase → **"Authentication"** → **"URL Configuration"**
2. In **"Site URL"** inserisci il tuo indirizzo Vercel (es. `https://tornei-calcio.vercel.app`)
3. In **"Redirect URLs"** aggiungi: `https://tornei-calcio.vercel.app/**`
4. Salva

---

## PASSO 6 — Primo accesso e creazione torneo

1. Vai su `tuosito.vercel.app/admin`
2. Clicca **"Registrati"** per creare il tuo account admin
3. Accedi con le credenziali appena create
4. Clicca **"+ Nuovo torneo"**
5. Compila nome, slug (es. `torneo-estate-2025`), tipo e colore
6. Il torneo sarà visibile su `tuosito.vercel.app/torneo/torneo-estate-2025`

---

## Come aggiungere altri admin

Per permettere ad altre persone di gestire i propri tornei:
- Ogni persona va su `/admin` e si registra autonomamente
- Ogni admin vede e gestisce **solo i propri tornei**
- I dati sono isolati grazie alle policy di sicurezza del database

---

## URL del sito

| Pagina | URL |
|--------|-----|
| Lista tutti i tornei | `tuosito.vercel.app` |
| Torneo pubblico | `tuosito.vercel.app/torneo/SLUG` |
| Area admin login | `tuosito.vercel.app/admin` |
| Dashboard admin | `tuosito.vercel.app/admin/dashboard` |
| Gestisci torneo | `tuosito.vercel.app/admin/torneo/ID` |

---

## Aggiornamenti futuri

Ogni volta che modifichi il codice e lo carichi su GitHub, Vercel aggiornerà
il sito automaticamente entro 1-2 minuti. Non devi fare nulla.

---

## Supporto

Per qualsiasi problema, torna a Claude e descrivi l'errore che vedi.
