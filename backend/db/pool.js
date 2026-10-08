// Single shared Postgres connection pool for the whole backend.
//
// Every module that talks to Postgres (tokenStore, chatHistory, groupStore)
// requires this file instead of creating its own `new Pool(...)` - hosted
// Postgres providers (including Supabase, even on paid tiers) cap how many
// simultaneous connections a project may have, and that cap is shared across
// every pool any process opens. One pool per module compounds quickly as
// more persistence gets added; one pool for the entire app is the correct
// fix.
//
// `null` when DATABASE_URL isn't set, so requiring this file is always safe
// even in memory-store mode - callers already gate their own usage of it
// behind `useMemoryStore` (see db/tokenStore.js) and never call `.query()`
// on it in that mode.
//
// `ssl: { rejectUnauthorized: false }` is required for Supabase-hosted
// Postgres (and is the standard, widely-used workaround for most hosted
// Postgres providers' certificate chains, including Render's own Postgres)
// - without it, the connection attempt fails outright before any query ever
// runs.
const { Pool } = require('pg');

module.exports = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;
