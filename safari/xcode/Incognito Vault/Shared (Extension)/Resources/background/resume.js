/* Incognito Vault — resume flow: stash a transcript, open a fresh
 * incognito/temporary chat, and hand the job to that tab's content script. */
"use strict";

(() => {
  const RESUME_KEY = "iv_resume";
  const RESUME_TTL = 2 * 60 * 1000;

  function buildResumePrompt(chat) {
    const transcript = chat.messages
      .map((m) => (m.role === "user" ? "**User:**" : "**Assistant:**") + "\n" + m.md)
      .join("\n\n");
    return (
      "I'm resuming a previous conversation. Below is the full transcript of what " +
      "we discussed before. Read it, then continue from where we left off — don't " +
      "re-answer everything, just pick up the thread.\n\n" +
      "----- PREVIOUS CONVERSATION -----\n\n" +
      transcript +
      "\n\n----- END OF TRANSCRIPT -----\n\n" +
      "Ready to continue."
    );
  }

  async function resumeChat(id) {
    const chat = await IV.db.get(id);
    if (!chat) return { ok: false, error: "Chat not found" };

    await IV.store.set({
      [RESUME_KEY]: {
        platform: chat.platform,
        prompt: buildResumePrompt(chat),
        createdAt: Date.now()
      }
    });

    const url =
      chat.platform === "chatgpt"
        ? "https://chatgpt.com/?temporary-chat=true" // temporary mode via URL param
        : "https://claude.ai/new"; // content script clicks the ghost button

    await IV.api.tabs.create({ url });
    return { ok: true };
  }

  /* Content scripts can't read storage.session themselves (Safari has no
   * setAccessLevel), so they ask for the job over messaging at boot. The job
   * is consumed only on a platform match — a stray tab of the other site must
   * not swallow it — and cleared once expired. */
  async function takeResumeJob(platform) {
    const stash = await IV.store.get(RESUME_KEY);
    const job = stash?.[RESUME_KEY];
    if (!job) return { ok: false };
    if (Date.now() - job.createdAt > RESUME_TTL) {
      await IV.store.remove(RESUME_KEY);
      return { ok: false };
    }
    if (job.platform !== platform) return { ok: false };
    await IV.store.remove(RESUME_KEY);
    return { ok: true, job };
  }

  IV.resume = { chat: resumeChat, take: takeResumeJob };
})();
