/* Incognito Vault — environment shim, loaded first in every context.
 * Chrome runs shared code in a service worker, Safari in a background page,
 * plus content scripts and the popup — `IV` on globalThis is the one namespace
 * they all share. `browser` is Safari/Firefox's promise-native API object;
 * Chrome MV3's `chrome` is promise-based too, so both sides of the ?? await
 * the same way. */
"use strict";

globalThis.IV = globalThis.IV || {};

IV.api = globalThis.browser ?? globalThis.chrome;

/* Background-only stash for short-lived handoffs (resume job, artifact
 * capture record). storage.session needs Chrome 102+ / Safari 16.4+; the
 * storage.local fallback risks only a stale key, and every reader guards
 * with a TTL. Content scripts never touch this — they ask over messaging. */
IV.store = IV.api.storage.session ?? IV.api.storage.local;
