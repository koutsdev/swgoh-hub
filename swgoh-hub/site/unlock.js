/* SWGOH Hub loader. Loads data.js fresh (not from the browser cache), then starts app.js.
   The cloud copy's data is password-locked (window.HUB_ENC, written by build.py): this asks for the
   password once per device, decrypts in the browser with WebCrypto (PBKDF2-SHA256 + AES-GCM) and keeps
   only the derived key in localStorage. Nothing readable is ever sent to or stored on the server. */
(function () {
  "use strict";
  var STORE = "hub-key";

  function load(src, done) {
    var s = document.createElement("script");
    s.src = src; s.onload = done; s.onerror = done;
    document.body.appendChild(s);
  }
  function start() { load("app.js", function () {}); }
  var fresh = /^https?:$/.test(location.protocol) ? "?v=" + Date.now() : "";
  load("data.js" + fresh, function () { if (window.HUB_ENC) unlock(window.HUB_ENC); else start(); });

  function bytes(b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function toB64(buf) { var a = new Uint8Array(buf), s = ""; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function saved() { try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { return null; } }
  function remember(E, raw) { try { localStorage.setItem(STORE, JSON.stringify({ salt: E.salt, key: toB64(raw) })); } catch (e) {} }
  function forget() { try { localStorage.removeItem(STORE); } catch (e) {} }

  function derive(password, E) {
    return crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (base) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: bytes(E.salt), iterations: E.iter }, base, 256);
      });
  }
  function open(raw, E) {
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"])
      .then(function (key) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(E.iv) }, key, bytes(E.data)); })
      .then(function (zipped) {
        return new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
      })
      .then(JSON.parse);
  }
  function ready(data) {
    window.HUB = data; window.HUB_ENC = undefined;
    var l = document.getElementById("lock"); if (l) l.remove();
    start();
  }

  function unlock(E) {
    if (!window.crypto || !crypto.subtle || typeof DecompressionStream === "undefined") {
      return ask(E, "This browser can't unlock the hub. Open it in an up-to-date Safari or Chrome.", true);
    }
    var k = saved();
    if (k && k.salt === E.salt) {
      open(bytes(k.key), E).then(ready, function () { forget(); ask(E, "The password changed. Enter the new one."); });
    } else ask(E);
  }

  function ask(E, note, blocked) {
    var wrap = document.getElementById("lock") || document.createElement("div");
    wrap.id = "lock"; wrap.className = "lock";
    wrap.innerHTML =
      '<form class="lockcard" autocomplete="on">' +
        '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="5"/><path d="M16 3v8M16 21v8M3 16h8M21 16h8"/></svg>' +
        '<div><div class="eyebrow">SWGOH Hub</div><h2>Enter your password</h2></div>' +
        '<p class="muted small" style="margin:0">Your roster is locked. This device remembers the password after the first time.</p>' +
        '<input class="sr" type="text" name="username" autocomplete="username" value="SWGOH Hub" tabindex="-1" aria-hidden="true">' +
        '<label class="sr" for="lockPw">Password</label>' +
        '<input id="lockPw" type="password" name="password" autocomplete="current-password" placeholder="Password" required>' +
        '<button class="btn" type="submit">Unlock</button>' +
        '<p class="lockmsg" role="alert"></p>' +
      '</form>';
    if (!wrap.parentNode) document.body.appendChild(wrap);
    var form = wrap.querySelector("form"), pw = wrap.querySelector("#lockPw"),
        btn = wrap.querySelector("button"), msg = wrap.querySelector(".lockmsg");
    msg.textContent = note || "";
    if (blocked) { pw.disabled = btn.disabled = true; return; }
    pw.focus();
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      btn.disabled = true; btn.textContent = "Unlocking…"; msg.textContent = "";
      var raw;
      derive(pw.value, E)
        .then(function (r) { raw = r; return open(r, E); })
        .then(function (data) { remember(E, raw); ready(data); }, function () {
          btn.disabled = false; btn.textContent = "Unlock";
          msg.textContent = "Wrong password. Try again."; pw.select();
        });
    });
  }
})();
