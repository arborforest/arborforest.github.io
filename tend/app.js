// The owner's Accounts dashboard (served at /accounts/app.js, only after her passcode). Owner 8 Nov 2026:
// works like a simple CRM: People (search, quick filters, columns she can hide and reorder, sort, click a person
// for their page with devices, activity, learning, feedback and her private notes), Feedback (one table,
// a Handled tick), Growth and Learning charts. "Updated …" and Refresh show how fresh it is; it also refreshes every 5 minutes.
(function () {
  "use strict";
  var app = document.getElementById("app");
  var tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip);
  var COLUMNS = [
    { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "signIn", label: "Sign-in" }, { key: "plan", label: "Plan" },
    { key: "ageRange", label: "Age" }, { key: "pictures", label: "Pictures" }, { key: "bytes", label: "Space" },
    { key: "mac", label: "Mac" }, { key: "ipad", label: "iPad" }, { key: "iphone", label: "iPhone" },
    { key: "filedPct", label: "Filed by itself" }, { key: "placesPct", label: "Places right" }, { key: "lessons", label: "Lessons" },
    { key: "feedbackCount", label: "Feedback" }, { key: "createdAt", label: "Joined" }, { key: "lastCheckIn", label: "Last check-in" }
  ];
  var state = { data: null, tab: "people", person: null, search: "", filter: "all", sort: { key: "lastCheckIn", dir: -1 },
                fbFilter: "new", cols: loadCols(), menu: false, loadedAt: null, error: null };

  function loadCols() {
    try {
      var saved = JSON.parse(localStorage.getItem("arbor.accounts.columns") || "null");
      if (saved && Array.isArray(saved.order)) {
        var known = COLUMNS.map(function (c) { return c.key; });
        var order = saved.order.filter(function (k) { return known.indexOf(k) >= 0; });
        known.forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
        return { order: order, hidden: (saved.hidden || []).filter(function (k) { return known.indexOf(k) >= 0; }) };
      }
    } catch (e) {}
    return { order: COLUMNS.map(function (c) { return c.key; }), hidden: ["createdAt", "lessons"] };
  }
  function saveCols() { try { localStorage.setItem("arbor.accounts.columns", JSON.stringify(state.cols)); } catch (e) {} }
  try { var t0 = localStorage.getItem("arbor.accounts.tab"); if (t0) state.tab = t0; } catch (e) {}

  // ---------- small helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  var DASH = '<span class="muted">—</span>';
  function ago(t) {
    if (!t) return '<span class="muted">Never</span>';
    var days = Math.floor((Date.now() - Date.parse(t)) / 86400000);
    if (days <= 0) return "Today"; if (days === 1) return "Yesterday"; if (days < 7) return days + " days ago";
    if (days < 14) return "1 week ago"; if (days < 60) return Math.floor(days / 7) + " weeks ago"; return Math.floor(days / 30) + " months ago";
  }
  function date(t) { return t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : DASH; }
  function time(t) { return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  function size(b) { if (b == null) return DASH; if (b >= 1e9) return (b / 1e9).toFixed(1) + " GB"; if (b >= 1e6) return Math.round(b / 1e6) + " MB"; return Math.max(1, Math.round(b / 1e3)) + " KB"; }
  function pct(v) { return v == null ? DASH : Math.round(v) + "%"; }
  function num(v) { return v == null ? DASH : Number(v).toLocaleString(); }
  function nameOf(p) { return p.name ? esc(p.name) : '<span class="muted">No name yet</span>'; }
  function shortID(id) { return "#" + id.slice(0, 8).toUpperCase(); }
  function signIn(p) { return p.signIns.map(function (s) { return s === "apple" ? "Apple" : "Google"; }).join(", ") || DASH; }
  function lastUsed(p) { return [p.mac, p.ipad, p.iphone].filter(Boolean).sort().pop() || null; }
  function weekStart(d) { var x = new Date(d + (d.length === 10 ? "T00:00:00Z" : "")); var day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x.toISOString().slice(0, 10); }
  function weeks(n) { var out = [], w = weekStart(new Date().toISOString().slice(0, 10)); for (var i = n - 1; i >= 0; i--) { var d = new Date(w + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 7 * i); out.push(d.toISOString().slice(0, 10)); } return out; }
  function weekLabel(w) { return new Date(w + "T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "short" }); }

  function cell(p, key) {
    switch (key) {
      case "name": return nameOf(p);
      case "email": return p.email ? esc(p.email) + (p.hiddenEmail ? ' <span class="muted">(Hide My Email)</span>' : "") : DASH;
      case "signIn": return signIn(p);
      case "plan": return esc(p.plan);
      case "ageRange": return p.ageRange ? esc(p.ageRange) : '<span class="muted">Not given</span>';
      case "pictures": return num(p.pictures);
      case "bytes": return size(p.bytes);
      case "mac": case "ipad": case "iphone": return ago(p[key]);
      case "filedPct": case "placesPct": return pct(p[key]);
      case "lessons": return num(p.lessons);
      case "feedbackCount": return p.feedbackCount ? String(p.feedbackCount) + (p.feedbackNew ? ' <span class="muted">(' + p.feedbackNew + " not handled)</span>" : "") : DASH;
      case "createdAt": return date(p.createdAt);
      case "lastCheckIn": return ago(p.lastCheckIn);
    }
    return "";
  }
  function sortValue(p, key) {
    var v = p[key];
    if (key === "name") return (p.name || "").toLowerCase();
    if (key === "signIn") return signIn(p);
    if (v == null) return key === "name" || key === "email" ? "" : -Infinity;
    if (["mac", "ipad", "iphone", "createdAt", "lastCheckIn"].indexOf(key) >= 0) return Date.parse(v);
    return typeof v === "string" ? v.toLowerCase() : v;
  }

  // ---------- data ----------
  function load() {
    state.error = null;
    return fetch(API + "/v1/admin/dashboard", { headers: { authorization: "Owner " + PASS }, cache: "no-store" }).then(function (r) {
      if (r.status === 401) { try { sessionStorage.removeItem("tend-pass"); } catch (e) {} location.reload(); throw new Error("signed out"); }
      if (!r.ok) throw new Error("status " + r.status);
      return r.json();
    }).then(function (d) {
      d.people.forEach(function (p) {
        var mine = d.feedback.filter(function (f) { return f.person === p.id; });
        p.feedbackCount = mine.length; p.feedbackNew = mine.filter(function (f) { return f.status !== "done"; }).length;
      });
      state.data = d; state.loadedAt = new Date(); render();
    }).catch(function (e) { if (window.console) console.error(e); state.error = "Couldn't reach Arbor's cloud. Try Refresh."; render(); });
  }
  function post(path, body) {
    return fetch(API + path.replace("/accounts/", "/v1/admin/"), { method: "POST", headers: { "content-type": "application/json", authorization: "Owner " + PASS }, body: JSON.stringify(body) });
  }

  // ---------- page ----------
  function render() {
    var d = state.data;
    var fbNew = d ? d.feedback.filter(function (f) { return f.status === "new"; }).length : 0;
    var wlNew = d && d.waitlist ? d.waitlist.filter(function (w) { return w.status === "new"; }).length : 0;
    var tabs = [["people", "People" + (d ? " (" + d.people.length + ")" : "")], ["feedback", "Feedback" + (d ? " (" + d.feedback.length + ")" : "")],
                ["waitlist", "Waitlist" + (d && d.waitlist ? " (" + d.waitlist.length + ")" : "")], ["growth", "Growth"], ["learning", "Learning"], ["ideas", "Ideas" + (d && d.ideas ? " (" + d.ideas.filter(function (x) { return !x.done; }).length + ")" : "")]];
    var html = '<div class="top"><h1>Accounts</h1><div class="fresh">' +
      (state.loadedAt ? "Updated " + time(state.loadedAt) : "Loading…") +
      ' <button class="link" id="refresh" type="button">Refresh</button></div></div>' +
      (state.error ? '<p class="bad">' + esc(state.error) + "</p>" : "") +
      '<div class="tabs">' + tabs.map(function (t) { return '<button class="tab' + (state.tab === t[0] && !state.person ? " on" : "") + '" data-tab="' + t[0] + '" type="button">' + t[1] + "</button>"; }).join("") + "</div>";
    app.innerHTML = html + '<div id="body"></div>';
    app.querySelector("#refresh").onclick = function () { this.textContent = "Refreshing…"; load(); };
    app.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () { state.tab = b.dataset.tab; state.person = null; try { localStorage.setItem("arbor.accounts.tab", state.tab); } catch (e) {} render(); };
    });
    if (!d) return;
    var body = app.querySelector("#body");
    if (state.person) return personPage(body, d.people.filter(function (p) { return p.id === state.person; })[0]);
    if (state.tab === "feedback") return feedbackPage(body);
    if (state.tab === "waitlist") return waitlistPage(body);
    if (state.tab === "growth") return growthPage(body);
    if (state.tab === "learning") return learningPage(body);
    if (state.tab === "ideas") return ideasPage(body);
    peoplePage(body);
  }

  // ---------- People ----------
  function peoplePage(body) {
    var d = state.data, now = Date.now();
    var week = now - 7 * 86400000, twoWeeks = now - 14 * 86400000;
    var list = d.people.filter(function (p) {
      var q = state.search.trim().toLowerCase();
      if (q && ((p.name || "") + " " + (p.email || "") + " " + p.id).toLowerCase().indexOf(q) < 0) return false;
      var lu = lastUsed(p);
      switch (state.filter) {
        case "plus": return p.plan === "Plus";
        case "basic": return p.plan === "Basic";
        case "active": return lu && Date.parse(lu) > week;
        case "quiet": return !lu || Date.parse(lu) < twoWeeks;
        case "feedback": return p.feedbackNew > 0;
      }
      return true;
    });
    var s = state.sort;
    list.sort(function (a, b) { var x = sortValue(a, s.key), y = sortValue(b, s.key); return (x < y ? -1 : x > y ? 1 : 0) * s.dir; });
    var active = d.people.filter(function (p) { var lu = lastUsed(p); return lu && Date.parse(lu) > week; }).length;
    var plus = d.people.filter(function (p) { return p.plan === "Plus"; }).length;
    var chips = [["all", "Everyone"], ["active", "Used this week"], ["quiet", "Quiet 2+ weeks"], ["plus", "Plus"], ["basic", "Basic"], ["feedback", "Feedback not handled"]];
    var cols = state.cols.order.filter(function (k) { return state.cols.hidden.indexOf(k) < 0; });
    var label = function (k) { return COLUMNS.filter(function (c) { return c.key === k; })[0].label; };
    // Owner 18 Nov 2026: same compact look as the waitlist (summary line, small controls, one line per person).
    body.innerHTML = '<div class="sumline"><span>' + d.people.length + (d.people.length === 1 ? " person" : " people") + " · " + active + " used Arbor this week · " + plus + " on Plus</span></div>" +
      '<div class="tools"><input id="q" type="search" placeholder="Search name or email" value="' + esc(state.search) + '">' +
      '<label class="muted" style="font-size:.9rem">Show <select id="pf" class="sel">' + chips.map(function (c) { return '<option value="' + c[0] + '"' + (state.filter === c[0] ? " selected" : "") + ">" + c[1] + "</option>"; }).join("") + "</select></label>" +
      '<span style="flex:1"></span><span style="position:relative"><button class="link" id="colbtn" type="button">Columns</button></span></div>' +
      '<div class="wrap"><table class="ppl"><thead><tr>' + cols.map(function (k) {
        return '<th class="sort" data-k="' + k + '">' + label(k) + (s.key === k ? (s.dir > 0 ? " ↑" : " ↓") : "") + "</th>";
      }).join("") + "</tr></thead><tbody>" + (list.length ? list.map(function (p) {
        return '<tr data-id="' + p.id + '" style="cursor:pointer">' + cols.map(function (k) { return '<td data-l="' + label(k) + '">' + cell(p, k) + "</td>"; }).join("") + "</tr>";
      }).join("") : '<tr><td colspan="' + cols.length + '" class="muted">Nobody here yet.</td></tr>') + "</tbody></table></div>" +
      '<p class="foot">Click a person to open their page. Pictures, picture names, Willows and Branches never appear here: Arbor\'s cloud only holds pictures scrambled.</p>';
    var q = body.querySelector("#q");
    q.oninput = function () { state.search = q.value; var pos = q.selectionStart; peoplePage(body); var n = body.querySelector("#q"); n.focus(); n.setSelectionRange(pos, pos); };
    body.querySelector("#pf").onchange = function () { state.filter = this.value; peoplePage(body); };
    body.querySelectorAll("th[data-k]").forEach(function (th) {
      th.onclick = function () { var k = th.dataset.k; state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : (k === "name" || k === "email" ? 1 : -1) }; peoplePage(body); };
    });
    body.querySelectorAll("tr[data-id]").forEach(function (tr) { tr.onclick = function () { state.person = tr.dataset.id; render(); window.scrollTo(0, 0); }; });
    body.querySelector("#colbtn").onclick = function (e) { e.stopPropagation(); columnMenu(body, this); };
  }

  function columnMenu(body, btn) {
    var old = document.querySelector(".menu"); if (old) { old.remove(); return; }
    var menu = el('<div class="menu" style="right:0;top:38px"></div>');
    function draw() {
      menu.innerHTML = '<div class="muted" style="font-size:.85rem;margin-bottom:6px">Tick to show. Arrows change the order.</div>' +
        state.cols.order.map(function (k, i) {
          var c = COLUMNS.filter(function (x) { return x.key === k; })[0];
          return '<div class="row"><input type="checkbox" data-k="' + k + '"' + (state.cols.hidden.indexOf(k) < 0 ? " checked" : "") +
            ' style="width:auto;margin:0"><span>' + c.label + '</span><button class="mv" data-up="' + i + '" type="button" aria-label="Move ' + c.label + ' up">↑</button>' +
            '<button class="mv" data-down="' + i + '" type="button" aria-label="Move ' + c.label + ' down">↓</button></div>';
        }).join("") + '<button class="btn" id="colreset" type="button" style="margin-top:8px">Show all, original order</button>';
      menu.querySelectorAll("input[data-k]").forEach(function (cb) {
        cb.onchange = function () { var k = cb.dataset.k, h = state.cols.hidden; if (cb.checked) h.splice(h.indexOf(k), 1); else h.push(k); saveCols(); refreshTable(); };
      });
      menu.querySelectorAll("[data-up],[data-down]").forEach(function (b) {
        b.onclick = function () {
          var i = Number(b.dataset.up != null ? b.dataset.up : b.dataset.down), j = b.dataset.up != null ? i - 1 : i + 1, o = state.cols.order;
          if (j < 0 || j >= o.length) return; var t = o[i]; o[i] = o[j]; o[j] = t; saveCols(); draw(); refreshTable();
        };
      });
      menu.querySelector("#colreset").onclick = function () { state.cols = { order: COLUMNS.map(function (c) { return c.key; }), hidden: [] }; saveCols(); draw(); refreshTable(); };
    }
    function refreshTable() { var keep = menu; peoplePage(body); body.querySelector("#colbtn").parentNode.appendChild(keep); }
    draw();
    btn.parentNode.appendChild(menu);
    menu.onclick = function (e) { e.stopPropagation(); };
    setTimeout(function () { document.addEventListener("click", function close() { menu.remove(); document.removeEventListener("click", close); }); }, 0);
  }

  // ---------- one person ----------
  function personPage(body, p) {
    if (!p) { state.person = null; return render(); }
    var d = state.data, mine = d.days.filter(function (x) { return x.id === p.id; });
    var fb = d.feedback.filter(function (f) { return f.person === p.id; });
    var devices = [["Mac", p.mac], ["iPad", p.ipad], ["iPhone", p.iphone]];
    body.innerHTML = '<p><button class="link" id="back" type="button">← All people</button></p>' +
      '<h2 style="margin:6px 0 2px">' + nameOf(p) + '</h2><p class="lead">' + (p.email ? esc(p.email) : "No email") +
      (p.hiddenEmail ? " · Apple Hide My Email (Apple forwards mail to them)" : "") + " · Account " + shortID(p.id) + " · Joined " + date(p.createdAt) + "</p>" +
      '<div class="grid">' +
      card("Account", "", '<table><tbody>' +
        row("Signed in with", signIn(p)) + row("Plan", esc(p.plan) + (p.plusUntil ? " until " + date(p.plusUntil) : "")) +
        row("Age", p.ageRange ? esc(p.ageRange) : '<span class="muted">Not given</span>') + row("Last signed in", ago(p.lastSignIn)) +
        row("Last check-in", ago(p.lastCheckIn)) + "</tbody></table>") +
      card("Devices", "When Arbor was last used on each kind of device", '<table><tbody>' + devices.map(function (x) { return row(x[0], ago(x[1])); }).join("") + "</tbody></table>") +
      card("Pictures and space", "Their Forest, from the device with the most", '<table><tbody>' + row("Pictures", num(p.pictures)) + row("Space", size(p.bytes)) + "</tbody></table>") +
      "</div>" +
      '<div class="grid" style="margin-top:14px">' +
      card("Days they used Arbor", "Each week, last 12 weeks", '<div id="c-days"></div>') +
      card("Pictures over time", "Each day Arbor checked in", '<div id="c-pics"></div>') +
      card("Filed by itself", "How often Arbor filed without asking them", '<div id="c-filed"></div>') +
      card("Places right", "How often they kept the place Arbor chose", '<div id="c-places"></div>') +
      "</div>" +
      '<div class="grid" style="margin-top:14px">' +
      card("Feedback and bug reports", fb.length ? fb.length + " sent" : "Nothing sent yet", '<div id="p-fb"></div>') +
      card("Your notes", "Private: only you see these", '<textarea id="note" rows="6" style="width:100%;box-sizing:border-box;font:inherit;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--bg);color:var(--fg)">' +
        esc(p.note) + '</textarea><p style="margin:8px 0 0"><button class="btn" id="savenote" type="button">Save notes</button> <span id="noted" class="muted"></span></p>') +
      "</div>";
    body.querySelector("#back").onclick = function () { state.person = null; render(); };
    body.querySelector("#savenote").onclick = function () {
      var v = body.querySelector("#note").value, msg = body.querySelector("#noted");
      msg.textContent = "Saving…";
      post("/accounts/note", { id: p.id, note: v }).then(function (r) { msg.textContent = r.ok ? "Saved " + time(new Date()) : "Couldn't save. Try again."; if (r.ok) p.note = v; });
    };
    var ws = weeks(12);
    bars(body.querySelector("#c-days"), ws.map(function (w) {
      var set = {}; mine.forEach(function (x) { if (weekStart(x.day) === w) set[x.day] = 1; });
      return { label: weekLabel(w), value: Object.keys(set).length, tip: "Week of " + weekLabel(w) + ": " + Object.keys(set).length + " days" };
    }), { max: 8 });
    var byDay = {}; mine.forEach(function (x) { if (x.pictures != null) byDay[x.day] = Math.max(byDay[x.day] || 0, x.pictures); });
    line(body.querySelector("#c-pics"), Object.keys(byDay).sort().map(function (k) { return { label: k, value: byDay[k], tip: date(k + "T12:00:00Z") + ": " + num(byDay[k]) + " pictures" }; }), {});
    ["filed", "places"].forEach(function (which) {
      var key = which === "filed" ? "filedPct" : "placesPct", days = {};
      mine.forEach(function (x) { if (x[key] != null) days[x.day] = x[key]; });
      line(body.querySelector("#c-" + which), Object.keys(days).sort().map(function (k) { return { label: k, value: days[k], tip: date(k + "T12:00:00Z") + ": " + Math.round(days[k]) + "%" }; }), { max: 100, unit: "%" });
    });
    feedbackList(body.querySelector("#p-fb"), fb, false);
  }
  function card(title, sub, inner) { return '<div class="card"><h3>' + title + "</h3>" + (sub ? '<p class="sub">' + sub + "</p>" : "") + inner + "</div>"; }
  function row(k, v) { return '<tr><td class="muted" style="width:45%">' + k + "</td><td>" + v + "</td></tr>"; }

  // ---------- Feedback ----------
  // Owner 18 Nov 2026: same as the waitlist: one line each, one "Handled" tick instead of New / Seen / Done
  // (ticked = status "done", unticked = "new"), newest first.
  function feedbackPage(body) {
    var d = state.data, bugs = d.feedback.filter(function (x) { return x.kind === "bug"; }).length, handled = d.feedback.filter(function (x) { return x.status === "done"; }).length;
    body.innerHTML = '<div class="sumline"><span>' + d.feedback.length + (d.feedback.length === 1 ? " message" : " messages") + " · " + bugs + (bugs === 1 ? " bug report" : " bug reports") + " · " + handled + " handled</span></div><div id=\"fblist\"></div>";
    feedbackList(body.querySelector("#fblist"), d.feedback, true);
  }
  function feedbackList(box, list, showPerson) {
    if (!list.length) { box.innerHTML = '<p class="empty">Nothing here.</p>'; return; }
    var people = {}; state.data.people.forEach(function (p) { people[p.id] = p; });
    box.innerHTML = '<div class="wrap"><table class="wl fb"><thead><tr>' + (showPerson ? "<th>From</th>" : "") + '<th>What they said</th><th>Device</th><th>Sent</th><th class="c">Handled</th></tr></thead><tbody>' +
      list.map(function (x) {
        var p = people[x.person];
        var media = x.isVideo ? '<a href="' + API + '/v1/admin/feedback-picture/' + x.id + '?t=' + encodeURIComponent(PASS) + '" target="_blank" rel="noopener">Video they attached</a>' :
          x.hasPicture ? '<a href="' + API + '/v1/admin/feedback-picture/' + x.id + '?t=' + encodeURIComponent(PASS) + '" target="_blank" rel="noopener"><img class="thumb" src="' + API + '/v1/admin/feedback-picture/' + x.id + '?t=' + encodeURIComponent(PASS) + '" alt="Picture they attached"></a>' : "";
        return "<tr>" + (showPerson ? '<td class="n">' + (p ? '<a href="#" data-person="' + p.id + '">' + nameOf(p) + "</a>" : '<span class="muted">Someone</span>') + "</td>" : "") +
          '<td class="' + (showPerson ? "e" : "n") + ' txt">' + (x.kind === "bug" ? '<span class="tag">Bug</span> ' : "") + esc(x.text) + (media ? '<div style="margin-top:6px">' + media + "</div>" : "") + "</td>" +
          '<td class="d">' + (x.device ? esc({ mac: "Mac", ipad: "iPad", iphone: "iPhone" }[x.device] || x.device) : "") +
            (x.appVersion ? '<span class="muted"> · Arbor ' + esc(x.appVersion) + "</span>" : "") + '<span class="phone"> · ' + date(x.at) + "</span></td>" +
          '<td class="j muted">' + date(x.at) + " " + time(x.at) + "</td>" +
          '<td class="c t"><input type="checkbox" class="tick" data-fbid="' + x.id + '"' + (x.status === "done" ? " checked" : "") + ' aria-label="Handled"></td></tr>';
      }).join("") + "</tbody></table></div>";
    box.querySelectorAll("[data-person]").forEach(function (a) { a.onclick = function (e) { e.preventDefault(); state.person = a.dataset.person; render(); window.scrollTo(0, 0); }; });
    box.querySelectorAll("input[data-fbid]").forEach(function (c) {
      c.onchange = function () {
        var st = c.checked ? "done" : "new"; c.disabled = true;
        post("/accounts/feedback-status", { id: c.dataset.fbid, status: st }).then(function (r) {
          c.disabled = false;
          if (!r.ok) { c.checked = !c.checked; return; }
          state.data.feedback.forEach(function (x) { if (x.id === c.dataset.fbid) x.status = st; });
          state.data.people.forEach(function (p) { var m = state.data.feedback.filter(function (f) { return f.person === p.id; }); p.feedbackNew = m.filter(function (f) { return f.status !== "done"; }).length; });
          render();
        }, function () { c.disabled = false; c.checked = !c.checked; });
      };
    });
  }

  // ---------- Ideas (owner 16 Nov 2026: "a section to write out my ideas") ----------
  // Write one, press Save (or Command-Return). Newest first; tick one off when it's done, change it, or delete it.
  function ideasPage(body) {
    var all = state.data.ideas || [], f = state.ideaFilter || "open";
    var list = all.filter(function (x) { return f === "all" || (f === "done" ? x.done : !x.done); });
    var chips = [["open", "Open (" + all.filter(function (x) { return !x.done; }).length + ")"], ["done", "Done (" + all.filter(function (x) { return x.done; }).length + ")"], ["all", "All (" + all.length + ")"]];
    body.innerHTML = '<div class="card" style="margin-bottom:14px"><textarea id="idea-new" rows="4" placeholder="Write an idea…" style="width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:inherit;resize:vertical"></textarea>' +
      '<p style="margin:8px 0 0"><button class="btn on" id="idea-save" type="button">Save idea</button> <span class="sub" id="idea-msg"></span></p></div>' +
      '<div class="tools"><div class="chips">' + chips.map(function (c) { return '<button class="btn' + (f === c[0] ? " on" : "") + '" data-if="' + c[0] + '" type="button">' + c[1] + "</button>"; }).join("") + "</div></div>" +
      (list.length ? list.map(function (x) {
        return '<div class="card" style="margin-bottom:10px' + (x.done ? ';opacity:.6' : '') + '"><p class="sub" style="margin:0 0 6px">' + date(x.at) + " " + time(x.at) + (x.done ? " · <i>done</i>" : "") + "</p>" +
          '<div data-itext="' + x.id + '" style="white-space:pre-wrap;margin:0">' + esc(x.text) + "</div>" +
          '<p style="margin:10px 0 0"><button class="btn" data-idone="' + x.id + '" type="button">' + (x.done ? "Not done" : "Done") + '</button> <button class="btn" data-iedit="' + x.id + '" type="button">Edit</button> <button class="btn" data-idel="' + x.id + '" type="button">Delete</button></p></div>';
      }).join("") : '<p class="empty">' + (f === "done" ? "Nothing ticked off yet." : "No ideas yet. Write the first one above.") + "</p>");
    var box = body.querySelector("#idea-new"), save = body.querySelector("#idea-save"), msg = body.querySelector("#idea-msg");
    try { box.value = sessionStorage.getItem("arbor.idea.draft") || ""; } catch (e) {}
    box.oninput = function () { msg.textContent = ""; try { sessionStorage.setItem("arbor.idea.draft", box.value); } catch (e) {} };
    function add() {
      var text = box.value.trim(); if (!text) { msg.textContent = "Write something first."; return; }
      save.disabled = true;
      post("/accounts/idea-add", { text: text }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        save.disabled = false;
        if (!j) { msg.textContent = "Couldn't save. Try again."; return; }
        (state.data.ideas = state.data.ideas || []).unshift({ id: j.id, text: text, done: false, at: j.at, updatedAt: j.at });
        try { sessionStorage.removeItem("arbor.idea.draft"); } catch (e) {}
        state.ideaFilter = "open"; render();
      }).catch(function () { save.disabled = false; msg.textContent = "Couldn't save. Try again."; });
    }
    save.onclick = add;
    box.onkeydown = function (e) { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(); };
    function find(id) { return all.filter(function (x) { return x.id === id; })[0]; }
    body.querySelectorAll("[data-if]").forEach(function (b) { b.onclick = function () { state.ideaFilter = b.dataset.if; ideasPage(body); }; });
    body.querySelectorAll("[data-idone]").forEach(function (b) {
      b.onclick = function () { var x = find(b.dataset.idone); b.disabled = true;
        post("/accounts/idea-update", { id: x.id, done: !x.done }).then(function (r) { if (r.ok) x.done = !x.done; render(); }); };
    });
    body.querySelectorAll("[data-iedit]").forEach(function (b) {
      b.onclick = function () {
        var x = find(b.dataset.iedit), holder = body.querySelector('[data-itext="' + x.id + '"]');
        if (b.textContent === "Save") {
          var t = holder.querySelector("textarea").value.trim(); if (!t) return;
          b.disabled = true;
          post("/accounts/idea-update", { id: x.id, text: t }).then(function (r) { if (r.ok) x.text = t; render(); });
          return;
        }
        holder.innerHTML = '<textarea rows="5" style="width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:inherit;resize:vertical"></textarea>';
        holder.querySelector("textarea").value = x.text; holder.querySelector("textarea").focus();
        b.textContent = "Save";
      };
    });
    body.querySelectorAll("[data-idel]").forEach(function (b) {
      b.onclick = function () { var x = find(b.dataset.idel);
        if (!confirm("Delete this idea? This can't be undone.")) return;
        b.disabled = true;
        post("/accounts/idea-delete", { id: x.id }).then(function (r) { if (r.ok) state.data.ideas = state.data.ideas.filter(function (i) { return i.id !== x.id; }); render(); }); };
    });
  }

  // ---------- Waitlist (the website's "Join the waitlist" form, owner 15 Nov 2026) ----------
  function waitlistPage(body) {
    // Owner 18 Nov 2026 (chose A, the table): one line per person; one "Emailed" tick instead of New / Seen / Done
    // (ticked = status "done", unticked = "new"); Remove sits behind the row's ⋯.
    var all = state.data.waitlist || [];
    var tally = {}; all.forEach(function (x) { x.devices.forEach(function (d) { d = d === "MacBook" || d === "iMac" ? "Mac" : d; tally[d] = (tally[d] || 0) + 1; }); });
    var emailed = all.filter(function (x) { return x.status === "done"; }).length, notes = all.filter(function (x) { return x.note; }).length;
    var summary = [all.length + (all.length === 1 ? " person" : " people")]
      .concat(Object.keys(tally).length ? [Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }).map(function (k) { return tally[k] + " " + esc(k); }).join(", ")] : [])
      .concat(notes ? [notes + (notes === 1 ? " left a note" : " left a note")] : []).concat([emailed + " emailed"]);
    body.innerHTML = '<div class="sumline"><span>' + summary.join(" · ") + '</span><button class="link" id="wlcopy" type="button">Copy all emails</button></div>' +
      (all.length ? '<div class="wrap"><table class="wl"><thead><tr><th>Name</th><th>Email</th><th>Device</th><th>Joined</th><th class="c">Emailed</th><th></th></tr></thead><tbody>' +
        all.map(function (x) {
          return '<tr><td class="n">' + esc(x.firstName + " " + x.lastName) + (x.language === "es" ? ' <span class="muted">· Español</span>' : "") +
            (x.note ? '<div class="note">“' + esc(x.note) + '”</div>' : "") + "</td>" +
            '<td class="e"><a href="mailto:' + esc(x.email) + '">' + esc(x.email) + "</a></td>" +
            '<td class="d">' + x.devices.map(function (d) { return esc(d === "MacBook" || d === "iMac" ? "Mac" : d); }).join(", ") + '<span class="phone"> · ' + date(x.at || x.updatedAt) + "</span></td>" +
            '<td class="j muted">' + date(x.at || x.updatedAt) + "</td>" +
            '<td class="c t"><input type="checkbox" class="tick" data-wlid="' + x.id + '"' + (x.status === "done" ? " checked" : "") + ' aria-label="Emailed ' + esc(x.firstName) + '"></td>' +
            '<td class="c m"><button class="more" data-wlmore="' + x.id + '" type="button" aria-label="More for ' + esc(x.firstName) + '">⋯</button></td></tr>';
        }).join("") + "</tbody></table></div>" : '<p class="empty">Nobody here yet.</p>');
    body.querySelector("#wlcopy").onclick = function () {
      var btn = this, text = all.map(function (x) { return x.email; }).join(", ");
      function done(m) { btn.textContent = m; setTimeout(function () { btn.textContent = "Copy all emails"; }, 2000); }
      try { navigator.clipboard.writeText(text).then(function () { done("Copied " + all.length); }, function () { done("Couldn't copy"); }); } catch (e) { done("Couldn't copy"); }
    };
    body.querySelectorAll("[data-wlmore]").forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var open = b.parentNode.querySelector(".menu"); document.querySelectorAll(".menu").forEach(function (m) { m.remove(); });
        if (open) return;
        // Fixed to the button, so the table's scroll box doesn't cut it off.
        var r = b.getBoundingClientRect(), m = document.createElement("div"); m.className = "menu";
        m.style.position = "fixed"; m.style.top = (r.bottom + 4) + "px"; m.style.right = Math.max(8, innerWidth - r.right) + "px"; m.style.minWidth = "200px";
        m.innerHTML = '<button class="link danger" data-wlrm="' + b.dataset.wlmore + '" type="button">Remove from the waitlist…</button>';
        b.parentNode.appendChild(m); wireWaitlistRemove(m);
      };
    });
    if (!state.wlMenuWired) { state.wlMenuWired = true; function shut() { document.querySelectorAll(".menu").forEach(function (m) { if (m.querySelector("[data-wlrm]")) m.remove(); }); } document.addEventListener("click", shut); addEventListener("scroll", shut, true); }
    body.querySelectorAll("input[data-wlid]").forEach(function (c) {
      c.onchange = function () {
        var st = c.checked ? "done" : "new"; c.disabled = true;
        post("/accounts/waitlist-status", { id: c.dataset.wlid, status: st }).then(function (r) {
          c.disabled = false;
          if (!r.ok) { c.checked = !c.checked; return; }
          state.data.waitlist.forEach(function (x) { if (x.id === c.dataset.wlid) x.status = st; });
          waitlistPage(body);
        }, function () { c.disabled = false; c.checked = !c.checked; });
      };
    });
  }

  // Remove: for someone who wrote in asking to leave (their own email has a one-click link too).
  function wireWaitlistRemove(body) {
    body.querySelectorAll("[data-wlrm]").forEach(function (b) {
      b.onclick = function () {
        var x = state.data.waitlist.filter(function (w) { return w.id === b.dataset.wlrm; })[0];
        if (!x || !confirm("Take " + x.email + " off the waitlist? This can't be undone.")) return;
        b.disabled = true;
        post("/accounts/waitlist-remove", { id: x.id }).then(function (r) {
          if (!r.ok) { b.disabled = false; return; }
          state.data.waitlist = state.data.waitlist.filter(function (w) { return w.id !== x.id; });
          render();
        });
      };
    });
  }

  // ---------- Growth ----------
  function growthPage(body) {
    var d = state.data;
    body.innerHTML = '<div class="grid">' +
      card("People with an account", "Total, by the day they joined", '<div id="g-people"></div>') +
      card("Active people", "People who used Arbor that week, last 12 weeks", '<div id="g-active"></div>') +
      card("Ages", "From birthdays people chose to give", '<div id="g-ages"></div>') +
      card("Devices", "People who used each kind of device in the last 30 days", '<div id="g-devices"></div>') +
      "</div>";
    var joined = d.people.map(function (p) { return (p.createdAt || "").slice(0, 10); }).filter(Boolean).sort(), total = 0, pts = [];
    joined.forEach(function (day, i) { total++; if (joined[i + 1] !== day) pts.push({ label: day, value: total, tip: date(day + "T12:00:00Z") + ": " + total + " people" }); });
    line(body.querySelector("#g-people"), pts, { step: true });
    var ws = weeks(12);
    bars(body.querySelector("#g-active"), ws.map(function (w) {
      var set = {}; d.days.forEach(function (x) { if (weekStart(x.day) === w) set[x.id] = 1; });
      var n = Object.keys(set).length; return { label: weekLabel(w), value: n, tip: "Week of " + weekLabel(w) + ": " + n + (n === 1 ? " person" : " people") };
    }), {});
    var order = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65 or older", "Not given"];
    bars(body.querySelector("#g-ages"), order.map(function (k) {
      var n = d.people.filter(function (p) { return (p.ageRange || "Not given") === k; }).length; return { label: k, value: n, tip: k + ": " + n };
    }), { rotate: true });
    var month = Date.now() - 30 * 86400000;
    bars(body.querySelector("#g-devices"), [["mac", "Mac"], ["ipad", "iPad"], ["iphone", "iPhone"]].map(function (k) {
      var n = d.people.filter(function (p) { return p[k[0]] && Date.parse(p[k[0]]) > month; }).length; return { label: k[1], value: n, tip: k[1] + ": " + n };
    }), {});
  }

  // ---------- Learning ----------
  function learningPage(body) {
    var d = state.data;
    body.innerHTML = '<p class="lead">How well Arbor\'s guesses are doing across everyone, week by week (the average of each person\'s latest number that week).</p><div class="grid">' +
      card("Filed by itself", "How often Arbor filed a picture without asking", '<div id="l-filed"></div>') +
      card("Places right", "How often people kept the place Arbor chose", '<div id="l-places"></div>') + "</div>" +
      '<h3 style="margin:22px 0 8px">By person, now</h3><div class="wrap"><table><thead><tr><th>Name</th><th>Filed by itself</th><th>Places right</th><th>Lessons</th><th>Last check-in</th></tr></thead><tbody>' +
      d.people.slice().sort(function (a, b) { return (b.lessons || 0) - (a.lessons || 0); }).map(function (p) {
        return '<tr data-id="' + p.id + '" style="cursor:pointer"><td>' + nameOf(p) + "</td><td>" + pct(p.filedPct) + "</td><td>" + pct(p.placesPct) + "</td><td>" + num(p.lessons) + "</td><td>" + ago(p.lastCheckIn) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    body.querySelectorAll("tr[data-id]").forEach(function (tr) { tr.onclick = function () { state.person = tr.dataset.id; render(); }; });
    ["filed", "places"].forEach(function (which) {
      var key = which === "filed" ? "filedPct" : "placesPct", ws = weeks(12);
      line(body.querySelector("#l-" + which), ws.map(function (w) {
        var latest = {}; d.days.forEach(function (x) { if (weekStart(x.day) === w && x[key] != null && (!latest[x.id] || latest[x.id].day < x.day)) latest[x.id] = x; });
        var vals = Object.keys(latest).map(function (k) { return latest[k][key]; });
        if (!vals.length) return null;
        var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        return { label: weekLabel(w), value: avg, tip: "Week of " + weekLabel(w) + ": " + Math.round(avg) + "% (" + vals.length + (vals.length === 1 ? " person)" : " people)") };
      }).filter(Boolean), { max: 100, unit: "%" });
    });
  }

  // ---------- charts (single series, one accent hue, hover tooltips) ----------
  var W = 520, H = 200, PAD = { l: 40, r: 12, t: 12, b: 34 };
  function scaleMax(vals, max) { if (max) return max; var m = Math.max.apply(null, vals.concat([1])); var step = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil(m / step) * step; }
  function frame(m, unit) {
    var g = "", iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    for (var i = 0; i <= 4; i++) {
      var y = PAD.t + ih - (ih * i) / 4, v = (m * i) / 4;
      g += '<line x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + y + '" y2="' + y + '" stroke="currentColor" stroke-opacity="' + (i ? 0.08 : 0.25) + '"/>' +
        '<text x="' + (PAD.l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + (Number.isInteger(v) ? v : v.toFixed(1)) + (unit || "") + "</text>";
    }
    return g;
  }
  function svg(box, inner) {
    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" style="color:var(--fg);display:block">' + inner + "</svg>";
    box.querySelectorAll("[data-tip]").forEach(function (n) {
      n.addEventListener("mousemove", function (e) { tip.textContent = n.getAttribute("data-tip"); tip.style.display = "block"; tip.style.left = e.clientX + 12 + "px"; tip.style.top = e.clientY - 28 + "px"; });
      n.addEventListener("mouseleave", function () { tip.style.display = "none"; });
    });
  }
  function bars(box, pts, opt) {
    if (!pts.some(function (p) { return p.value > 0; })) { box.innerHTML = '<p class="empty">Nothing yet. This fills in as people use Arbor.</p>'; return; }
    var m = scaleMax(pts.map(function (p) { return p.value; }), opt.max), iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b, bw = iw / pts.length;
    var g = frame(m, "");
    pts.forEach(function (p, i) {
      var h = (ih * p.value) / m, x = PAD.l + i * bw + bw * 0.18, w = bw * 0.64, y = PAD.t + ih - h;
      if (h > 0) g += '<path d="M' + x + "," + (PAD.t + ih) + "V" + (y + Math.min(4, h)) + "q0,-" + Math.min(4, h) + " " + Math.min(4, h) + ",-" + Math.min(4, h) + "H" + (x + w - Math.min(4, h)) +
        "q" + Math.min(4, h) + ",0 " + Math.min(4, h) + "," + Math.min(4, h) + 'V' + (PAD.t + ih) + 'Z" fill="var(--accent)"/>';
      g += '<rect x="' + (PAD.l + i * bw) + '" y="' + PAD.t + '" width="' + bw + '" height="' + ih + '" fill="transparent" data-tip="' + esc(p.tip) + '"/>';
      if (pts.length <= 12 && (i % (pts.length > 8 ? 2 : 1) === 0 || opt.rotate))
        g += '<text x="' + (PAD.l + i * bw + bw / 2) + '" y="' + (H - 12) + '" text-anchor="middle" style="font-size:' + (opt.rotate ? 10 : 11) + 'px">' + esc(p.label) + "</text>";
    });
    svg(box, g);
  }
  function line(box, pts, opt) {
    if (pts.length < 2) { box.innerHTML = '<p class="empty">' + (pts.length ? "One reading so far (" + esc(pts[0].tip) + "). A line appears after the next." : "Nothing yet. This fills in as people use Arbor.") + "</p>"; return; }
    var m = scaleMax(pts.map(function (p) { return p.value; }), opt.max), iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
    var xs = function (i) { return PAD.l + (iw * i) / (pts.length - 1); }, ys = function (v) { return PAD.t + ih - (ih * v) / m; };
    var d = pts.map(function (p, i) { return (i ? (opt.step ? "H" + xs(i) + "V" + ys(p.value) : "L" + xs(i) + "," + ys(p.value)) : "M" + xs(i) + "," + ys(p.value)); }).join("");
    var g = frame(m, opt.unit) + '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>';
    pts.forEach(function (p, i) {
      g += '<circle cx="' + xs(i) + '" cy="' + ys(p.value) + '" r="4" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>' +
        '<rect x="' + (xs(i) - iw / pts.length / 2) + '" y="' + PAD.t + '" width="' + iw / pts.length + '" height="' + ih + '" fill="transparent" data-tip="' + esc(p.tip) + '"/>';
    });
    var first = pts[0].label, last = pts[pts.length - 1].label, fmt = function (l) { return /^\d{4}-\d{2}-\d{2}$/.test(l) ? weekLabel(l) : l; };
    g += '<text x="' + PAD.l + '" y="' + (H - 12) + '">' + esc(fmt(first)) + '</text><text x="' + (W - PAD.r) + '" y="' + (H - 12) + '" text-anchor="end">' + esc(fmt(last)) + "</text>";
    svg(box, g);
  }

  load();
  setInterval(load, 5 * 60 * 1000);
})();
