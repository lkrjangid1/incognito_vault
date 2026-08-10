/* Incognito Vault — Chrome MV3 service worker entry.
 * Order matters: env.js defines the IV namespace, platform/save.js provides
 * the save layer main.js routes to. Safari loads the same files (minus this
 * loader) via background.scripts in its manifest — a background page has no
 * importScripts, a service worker has no <script> tags. */
"use strict";

importScripts(
  "lib/env.js",
  "background/db.js",
  "background/export.js",
  "platform/save.js",
  "background/resume.js",
  "background/main.js"
);
