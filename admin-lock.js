// Simple client-side password gate for admin.html.
// NOTE: This is NOT real security. Anyone who views this file's source
// can see the hash and could brute-force or bypass it. It only prevents
// casual visitors from stumbling into the content manager.

(function () {
  // SHA-256 hash of the admin password. Change PASSWORD_HASH to update it
  // (generate a new hash and paste it here if you ever change the password).
  const PASSWORD_HASH = "f296867839c8befafed32b55a7c11ab4ad14387d2434b970a55237d537bc9353";
  const SESSION_KEY = "ctk-admin-unlocked";

  const overlay = document.getElementById("lock-overlay");
  const content = document.getElementById("admin-content");
  const form = document.getElementById("lock-form");
  const input = document.getElementById("lock-password");
  const errorEl = document.getElementById("lock-error");

  async function sha256Hex(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function unlock() {
    overlay.style.display = "none";
    content.style.display = "";
    input.value = "";
  }

  // Stay unlocked for the rest of this browser tab session.
  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    unlock();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    const attempt = input.value;
    if (!attempt) return;

    const hash = await sha256Hex(attempt);
    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem(SESSION_KEY, "1");
      unlock();
    } else {
      errorEl.textContent = "비밀번호가 틀렸습니다.";
      input.value = "";
      input.focus();
    }
  });
})();
