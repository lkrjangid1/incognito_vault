/* Incognito Vault — IndexedDB history layer (background only).
 * Persists chat records in the extension's own origin, so the history
 * survives even though the site-side chat is ephemeral. */
"use strict";

(() => {
  const DB_NAME = "incognito-vault";
  const STORE = "chats";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("capturedAt", "capturedAt");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(record) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbGet(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbList() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result || []).sort((a, b) => b.capturedAt - a.capturedAt);
        // Popup only needs metadata — keep the message bodies out of the wire.
        resolve(
          rows.map(({ id, title, platform, capturedAt, messageCount, artifactCount }) => ({
            id, title, platform, capturedAt, messageCount, artifactCount
          }))
        );
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function dbDelete(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  IV.db = { put: dbPut, get: dbGet, list: dbList, remove: dbDelete };
})();
