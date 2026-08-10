/* Incognito Vault — Safari save layer.
 * Safari Web Extensions have no downloads API: no downloads.download for
 * writing into a Downloads subfolder, and no onDeterminingFilename for
 * renaming Claude's own artifact downloads. So the export is returned to the
 * calling DOM context (content script or popup) as a { zipName, files }
 * bundle; lib/download-client.js zips it there and saves one
 * IncognitoVault_<stamp>_<slug>.zip that unpacks to the same folder Chrome
 * writes directly. Content-less "ref" artifacts can't be captured at all —
 * the transcript tells the user to use Claude's own Download button. */
"use strict";

(() => {
  IV.platform = "safari";

  function bundle(chat) {
    const { slug, stamp, artifactFile, buildArtifactMarkdown, buildMarkdown } = IV.export;
    const folder = `${stamp(chat.capturedAt)}_${slug(chat.title)}`;

    const files = [
      {
        name: `${folder}/${slug(chat.title)}.md`,
        text: buildMarkdown(chat, { artifactCapture: false })
      }
    ];
    const artifacts = chat.artifacts || [];
    for (let i = 0; i < artifacts.length; i++) {
      if (!artifacts[i].content) continue; // refs — see header comment
      files.push({
        name: `${folder}/${artifactFile(artifacts[i], i)}`,
        text: buildArtifactMarkdown(artifacts[i], i)
      });
    }

    return { zipName: `IncognitoVault_${folder}.zip`, files, timestamp: chat.capturedAt };
  }

  IV.save = {
    capabilities: { artifactCapture: false },
    async exportFiles(chat) {
      return { downloadedArtifacts: 0, download: bundle(chat) };
    }
  };
})();
