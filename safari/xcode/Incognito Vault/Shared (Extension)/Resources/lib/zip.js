/* Incognito Vault — minimal ZIP writer (store-only, no compression).
 * Safari has no downloads API, so exports there arrive as one ZIP built here
 * and saved via a blob link (lib/download-client.js). Ships inert on Chrome,
 * where the background writes real files instead. Text-only entries, UTF-8
 * names, no ZIP64 — chat exports are nowhere near 4 GB or 65k files. */
"use strict";

(() => {
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(ts) {
    const d = new Date(ts);
    const year = Math.max(1980, d.getFullYear()); // DOS epoch — clamp, don't wrap
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  /* build([{ name, text }], timestamp?) → Uint8Array of a ZIP archive. */
  function build(files, timestamp = Date.now()) {
    const enc = new TextEncoder();
    const { time, date } = dosDateTime(timestamp);
    const local = [];   // local headers + data, in file order
    const central = []; // central directory records
    let offset = 0;

    for (const f of files) {
      const name = enc.encode(f.name);
      const data = enc.encode(f.text);
      const crc = crc32(data);

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);      // local file header signature
      lh.setUint16(4, 20, true);              // version needed to extract
      lh.setUint16(6, 0x0800, true);          // flags: UTF-8 filename
      lh.setUint16(8, 0, true);               // method: store
      lh.setUint16(10, time, true);
      lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);    // compressed size (== raw, stored)
      lh.setUint32(22, data.length, true);    // uncompressed size
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);              // extra field length

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);      // central directory signature
      cd.setUint16(4, 20, true);              // version made by
      cd.setUint16(6, 20, true);              // version needed
      cd.setUint16(8, 0x0800, true);          // flags: UTF-8 filename
      cd.setUint16(10, 0, true);              // method: store
      cd.setUint16(12, time, true);
      cd.setUint16(14, date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      // 30–41: extra/comment lengths, disk number, attributes — all zero
      cd.setUint32(42, offset, true);         // offset of the local header

      local.push(new Uint8Array(lh.buffer), name, data);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    }

    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);      // end-of-central-directory signature
    eocd.setUint16(8, files.length, true);    // entries on this disk
    eocd.setUint16(10, files.length, true);   // entries total
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, offset, true);         // central directory offset
    // 20: comment length = 0

    const out = new Uint8Array(offset + cdSize + 22);
    let p = 0;
    for (const chunk of [...local, ...central, new Uint8Array(eocd.buffer)]) {
      out.set(chunk, p);
      p += chunk.length;
    }
    return out;
  }

  IV.zip = { build };
})();
