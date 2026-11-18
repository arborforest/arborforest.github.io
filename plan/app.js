// arborcurator.com/plan (owner 18 Nov 2026): her Planning Library, from Arbor's cloud, behind her passcode.
// Front page = today's Planning Library front page with live percentages; each page = today's page (ticks, Later and
// Maybe tags, folded research, "On this page"); the top line opens the overhead view of all 19 pages; Edit page lets
// her change any wording, add, move or remove points and sections, and leave notes, with Undo.
(function () {
  var app = document.getElementById("app");
  var overview = null, page = null, editing = false, stamping = null, statusText = "";
  var INTRO = "Planning for the parts of Arbor nobody had planned yet, one page per part. Tick each point when you've gone over it or it's done.";

  // ---------- talking to Arbor's cloud ----------
  function call(method, path, body) {
    return fetch(API + path, { method: method, headers: Object.assign({ authorization: "Owner " + PASS }, body ? { "content-type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined, cache: "no-store" })
      .then(function (r) {
        if (r.status === 401) { try { sessionStorage.removeItem("tend-pass"); } catch (e) {} location.reload(); throw new Error("signed out"); }
        return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || "failed"); e.body = j; e.status = r.status; throw e; } return j; });
      });
  }
  var get = function (p) { return call("GET", p); }, post = function (p, b) { return call("POST", p, b); };
  function oops(e) { setStatus(e && e.status === 409 ? "This page changed somewhere else; it has been reloaded." : "That didn't save. Check the connection and try again."); }

  // ---------- small helpers ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function pct(d, t) { return t ? Math.round(d * 100 / t) : 0; }
  function shortDate(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
  function on(kind, key) { var m = page && page.marks[kind][key]; return !!(m && m.on); }
  function setStatus(t) { statusText = t; var s = document.querySelector(".pg-status"); if (s) s.textContent = statusLine(); }
  function statusLine() {
    if (stamping) return "Click a point or heading to tag it " + (stamping === "later" ? "Later" : "Maybe") + ". Click it again to untag.";
    if (editing) return "Click any wording to change it. Changes save as you go; Undo takes back the last one.";
    return statusText || "Saved in Arbor's cloud, the same on every device.";
  }
  function bar(p) { return '<div class="pg-bar"><div class="pg-fill" style="width:' + p + '%"></div></div>'; }

  // ---------- routing ----------
  function route() {
    var m = /^#p(\d\d)$/.exec(location.hash);
    var ov = document.querySelector(".ov"); if (ov) ov.remove(); document.body.classList.remove("ov-on");
    stamping = null; editing = false; statusText = "";
    if (m) loadPage(m[1]); else loadFront();
  }
  addEventListener("hashchange", route);

  // ---------- front page ----------
  function loadFront() {
    get("/v1/admin/plan").then(function (o) { overview = o; page = null; editing = false; drawFront(); scrollTo(0, 0); }).catch(function () { app.innerHTML = '<p class="lead">Couldn\'t reach Arbor\'s cloud. Refresh to try again.</p>'; });
  }
  function groups() {
    var g = []; overview.pages.forEach(function (p) { var x = g[g.length - 1]; if (!x || x.name !== p.group) g.push(x = { name: p.group, pages: [] }); x.pages.push(p); }); return g;
  }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function drawFront() {
    var total = 0, done = 0; overview.pages.forEach(function (p) { total += p.points; done += p.done; });
    var g = groups();
    app.innerHTML =
      '<header class="top"><p class="backrow"><a href="../">&larr; Back to the website</a><span aria-hidden="true"> · </span><a href="../tend/">Accounts</a></p><p class="crumbs"><button class="ov-open" type="button">19 pages</button></p><h1>Arbor Planning Library</h1><p class="blurb">' + esc(INTRO) + "</p></header>" +
      '<div class="layout"><main class="content panel">' +
      '<div class="progress"><div class="pg-top"><span class="pg-pct">' + pct(done, total) + '%</span><span>' + done + " of " + total + " points checked off, across all 19 pages</span></div>" + bar(pct(done, total)) + '<div class="pg-status">' + esc(statusLine()) + "</div></div>" +
      '<p class="lede">Each page is one area of Arbor that had little or no planning before. Every part was researched from the project\'s own files and notes, and from outside sources where a fact needed checking.</p>' +
      '<aside class="note">These are plans to read and choose from later. They don\'t change the app. When you pick something to build, a chat on your Mac does the work.</aside>' +
      '<div class="searchrow"><label for="find" class="visually-hidden">Find a point or heading in any page</label><input id="find" type="search" placeholder="Find a point or heading in any page, for example trademark, Reddit, Spanish" autocomplete="off" spellcheck="false"><span id="find-count" class="find-count" aria-live="polite"></span></div><ul id="find-results" class="find-results" hidden></ul>' +
      g.map(function (x) {
        return '<section class="sec-group" id="g-' + slug(x.name) + '"><h2>' + esc(x.name) + '</h2><ul class="parts">' + x.pages.map(function (p) {
          return '<li><a class="part" href="#p' + p.id + '"><span class="part-name">' + esc(p.name) + '<span class="part-pct">' + pct(p.done, p.points) + '%</span></span>' + bar(pct(p.done, p.points)) + '<span class="part-blurb">' + esc(p.blurb) + "</span></a></li>";
        }).join("") + "</ul></section>";
      }).join("") +
      '</main><nav class="toc" aria-label="On this page"><div class="toc-title">On this page:</div>' +
      g.map(function (x) { return '<a href="#g-' + slug(x.name) + '" data-go="g-' + slug(x.name) + '">' + esc(x.name) + "</a>"; }).join("") + "</nav></div>";
    wireOverview(null); wireToc(); wireFind();
  }

  // Search every page's headings and points (pages are fetched once, when she first types).
  var allDocs = null;
  function wireFind() {
    var box = document.getElementById("find"), res = document.getElementById("find-results"), count = document.getElementById("find-count");
    box.addEventListener("input", function () {
      var q = box.value.trim().toLowerCase();
      if (q.length < 2) { res.hidden = true; count.textContent = ""; return; }
      if (!allDocs) {
        count.textContent = "Looking…";
        Promise.all(overview.pages.map(function (p) { return get("/v1/admin/plan/page/" + p.id).then(function (r) { return r.doc; }); }))
          .then(function (docs) { allDocs = docs; box.dispatchEvent(new Event("input")); });
        return;
      }
      var hits = [];
      allDocs.forEach(function (d) {
        (d.sections || []).forEach(function (s) {
          if (s.title.toLowerCase().indexOf(q) >= 0) hits.push({ page: d, text: s.title, anchor: s.id });
          (s.points || []).forEach(function (pt) { if (pt.text.toLowerCase().indexOf(q) >= 0) hits.push({ page: d, text: pt.text.replace(/\*\*/g, ""), anchor: pt.id }); });
        });
      });
      count.textContent = hits.length + (hits.length === 1 ? " match" : " matches");
      res.hidden = false;
      res.innerHTML = hits.length ? hits.slice(0, 60).map(function (h) {
        return '<li><a href="#p' + h.page.id + '" data-jump="' + esc(h.anchor) + '">' + esc(h.text) + '<span class="where">' + esc(h.page.name) + "</span></a></li>";
      }).join("") : '<li class="empty">Nothing found.</li>';
    });
    res.addEventListener("click", function (e) { var a = e.target.closest("a[data-jump]"); if (a) jumpTo = a.dataset.jump; });
  }
  var jumpTo = null;

  // ---------- one page ----------
  function loadPage(id) {
    var first = overview ? Promise.resolve() : get("/v1/admin/plan").then(function (o) { overview = o; });
    first.then(function () { return get("/v1/admin/plan/page/" + id); }).then(function (r) {
      page = { id: id, doc: r.doc, marks: r.marks, updated: r.updated, canUndo: r.canUndo };
      drawPage(true);
    }).catch(function () { app.innerHTML = '<p class="lead">Couldn\'t open that page. <a href="#">Back to the front page</a></p>'; });
  }
  function counts() {
    var t = 0, d = 0; page.doc.sections.forEach(function (s) { s.points.forEach(function (p) { t++; if (on("tick", p.id)) d++; }); }); return { t: t, d: d };
  }
  function tags(key) {
    return '<span class="tags">' + ["later", "maybe"].map(function (k) {
      return '<button type="button" class="tag tag-' + k + '" data-tag="' + k + '" data-key="' + esc(key) + '" aria-pressed="' + on(k, key) + '" title="Remove the tag">' + (k === "later" ? "Later" : "Maybe") + " ×</button>";
    }).join("") + "</span>";
  }
  function pointHtml(s, p) {
    var t = page.marks.tick[p.id], n = page.marks.note[p.id];
    var when = t && t.on ? (t.note ? t.note : (t.at ? "Checked " + shortDate(t.at) : "")) : "";
    return '<li data-id="' + esc(p.id) + '" class="' + (t && t.on ? "is-checked" : "") + '">' +
      '<button class="ck" type="button" role="checkbox" aria-checked="' + !!(t && t.on) + '" aria-label="Checked: ' + esc(p.text.replace(/\*\*/g, "").slice(0, 80)) + '"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<div class="ck-body"><span class="pt-text" data-edit="point">' + inline(p.text) + '</span><span class="ck-when">' + esc(when) + "</span>" +
      (n && n.on ? '<span class="pt-note" data-edit="point">Note: ' + esc(n.note) + "</span>" : "") + "</div>" + tags(p.id) + "</li>";
  }
  function drawPage(top) {
    var d = page.doc, c = counts(), num = parseInt(d.id, 10);
    var list = overview.pages, i = list.findIndex(function (p) { return p.id === d.id; });
    var prev = list[i - 1], next = list[i + 1];
    var y = scrollY;
    app.innerHTML =
      '<header class="top"><p class="backrow"><a href="../">&larr; Back to the website</a><span aria-hidden="true"> · </span><a href="../tend/">Accounts</a></p><p class="crumbs"><a href="#">Arbor Planning Library</a> · <button class="ov-open" type="button">part ' + num + " of 19</button></p>" +
      '<h1 data-edit="name">' + esc(d.name) + '</h1><p class="blurb" data-edit="blurb">' + inline(d.blurb || "") + "</p></header>" +
      '<div class="layout' + (editing ? " editing" : "") + (stamping ? " stamping" : "") + '"><main class="content panel">' +
      (d.intro ? '<div class="page-intro">' + d.intro + "</div>" : "") +
      '<div class="progress"><div class="pg-top"><span class="pg-pct">' + pct(c.d, c.t) + "%</span><span>" + c.d + " of " + c.t + " points checked off</span></div>" + bar(pct(c.d, c.t)) +
      '<div class="pg-status">' + esc(statusLine()) + '</div><div class="stamp-row">' +
      ["later", "maybe"].map(function (k) { return '<button type="button" class="stamp-btn stamp-' + k + '" data-stamp="' + k + '" aria-pressed="' + (stamping === k) + '">' + (stamping === k ? "Done tagging" : (k === "later" ? "Later" : "Maybe") + " tag") + "</button>"; }).join("") +
      '<button type="button" class="stamp-btn stamp-edit" data-act="edit" aria-pressed="' + editing + '">' + (editing ? "Done editing" : "Edit page") + "</button>" +
      (editing ? '<button type="button" class="stamp-btn" data-act="undo"' + (page.canUndo ? "" : " disabled") + ">Undo</button>" : "") + "</div></div>" +
      d.sections.map(function (s) {
        var sc = s.points.filter(function (p) { return on("tick", p.id); }).length;
        return '<section class="sec" id="' + esc(s.id) + '"><h2><span class="sec-title" data-edit="section">' + esc(s.title) + '</span><span class="sec-side">' + tags("sec:" + s.id) +
          '<span class="sec-count' + (s.points.length && sc === s.points.length ? " all" : "") + '">' + (s.points.length ? sc + " of " + s.points.length + " checked" : "") + "</span></span></h2>" +
          (s.intro && s.intro.length ? '<p class="sec-intro" data-edit="intro">' + inline(s.intro.join(" ")) + "</p>" : (editing ? '<p class="sec-intro add-intro" data-edit="intro">Add a line under the heading</p>' : "")) +
          '<ul class="checks">' + s.points.map(function (p) { return pointHtml(s, p); }).join("") + "</ul>" +
          (editing ? '<button type="button" class="add-btn" data-act="add-point">Add a point</button>' : "") +
          (s.research || []).map(function (r) { return '<details class="ref"><summary>The research behind this: ' + esc(r.title) + '</summary><div class="refbody">' + r.html + "</div></details>"; }).join("") +
          "</section>";
      }).join("") +
      (editing ? '<button type="button" class="add-btn add-sec" data-act="add-section">Add a section</button>' : "") +
      (d.more && d.more.length ? '<section class="sec" id="more-background"><h2>More background</h2><p class="sec-intro">Reference only, from the original research.</p>' +
        d.more.map(function (r) { return '<details class="ref"><summary>' + esc(r.title) + '</summary><div class="refbody">' + r.html + "</div></details>"; }).join("") + "</section>" : "") +
      '<nav class="prevnext">' + (prev ? '<a href="#p' + prev.id + '">‹ ' + esc(prev.name) + "</a>" : "<span></span>") + (next ? '<a href="#p' + next.id + '">' + esc(next.name) + " ›</a>" : "") + "</nav>" +
      '</main><nav class="toc" aria-label="On this page"><div class="toc-title">On this page:</div>' +
      d.sections.map(function (s) { var sc = s.points.filter(function (p) { return on("tick", p.id); }).length;
        return '<a href="#' + esc(s.id) + '" data-go="' + esc(s.id) + '"' + (on("later", "sec:" + s.id) ? ' class="is-later"' : "") + ">" + esc(s.title) + '<span class="tc' + (s.points.length && sc === s.points.length ? " all" : "") + '">' + (s.points.length ? sc + "/" + s.points.length : "") + "</span></a>"; }).join("") +
      (d.more && d.more.length ? '<a href="#more-background" data-go="more-background">More background</a>' : "") + "</nav></div>";
    wirePage(); wireOverview(d.id); wireToc();
    if (jumpTo) { var t = document.querySelector('[data-id="' + jumpTo + '"]') || document.getElementById(jumpTo); jumpTo = null; if (t) { t.scrollIntoView({ block: "center" }); return; } }
    if (top) scrollTo(0, 0); else scrollTo(0, y);
  }

  function saveMark(kind, key, value) {
    page.marks[kind][key] = Object.assign({}, page.marks[kind][key] || {}, value, { at: new Date().toISOString() });
    drawPage(false);
    return post("/v1/admin/plan/mark", Object.assign({ page: page.id, kind: kind, key: key }, value))
      .then(function () { var p = overview.pages.find(function (x) { return x.id === page.id; }); if (p && kind === "tick") p.done = counts().d; })
      .catch(oops);
  }
  function edit(body) {
    setStatus("Saving…");
    return post("/v1/admin/plan/edit", Object.assign({ page: page.id, since: page.updated }, body)).then(function (r) {
      page.doc = r.doc; page.updated = r.at; page.canUndo = true; statusText = "";
      var p = overview.pages.find(function (x) { return x.id === page.id; }); if (p) { p.name = r.doc.name; p.blurb = r.doc.blurb; var c = counts(); p.points = c.t; p.done = c.d; }
      drawPage(false); return r;
    }).catch(function (e) { if (e.status === 409 && e.body && e.body.doc) { page.doc = e.body.doc; page.updated = e.body.updated; drawPage(false); } oops(e); });
  }

  // An editor in place of the words being changed.
  function openEditor(el, opts) {
    if (document.querySelector(".editor")) return;
    var box = document.createElement("div"); box.className = "editor";
    var ta = document.createElement(opts.single ? "input" : "textarea"); ta.value = opts.value; ta.className = "editor-text"; ta.setAttribute("aria-label", opts.label);
    if (!opts.single) ta.rows = Math.max(2, Math.ceil(opts.value.length / 70));
    box.appendChild(ta);
    var row = document.createElement("div"); row.className = "editor-row";
    function btn(label, fn, cls) { var b = document.createElement("button"); b.type = "button"; b.textContent = label; if (cls) b.className = cls; b.addEventListener("click", fn); row.appendChild(b); return b; }
    btn("Save", function () { var v = ta.value.trim(); if (!v && !opts.allowEmpty) return ta.focus(); opts.save(v); }, "primary");
    btn("Cancel", function () { drawPage(false); });
    (opts.extra || []).forEach(function (x) { btn(x[0], x[1], x[2]); });
    if (opts.hint) { var h = document.createElement("span"); h.className = "editor-hint"; h.textContent = opts.hint; row.appendChild(h); }
    box.appendChild(row);
    el.replaceWith(box); ta.focus(); if (ta.setSelectionRange) ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Escape") drawPage(false);
      if (e.key === "Enter" && (opts.single || e.metaKey || e.ctrlKey)) { e.preventDefault(); row.querySelector(".primary").click(); }
    });
  }
  function noteEditor(li, key) {
    var n = page.marks.note[key];
    var body = li.querySelector(".ck-body"); var spot = document.createElement("span"); body.appendChild(spot);
    openEditor(spot, { value: (n && n.note) || "", label: "Note", allowEmpty: true, hint: "Leave it empty to remove the note.",
      save: function (v) { saveMark("note", key, { note: v, on: !!v.trim() }); } });
  }

  function wirePage() {
    var root = app;
    root.querySelector("[data-act=edit]").addEventListener("click", function () { editing = !editing; stamping = null; drawPage(false); });
    var undo = root.querySelector("[data-act=undo]");
    if (undo) undo.addEventListener("click", function () {
      post("/v1/admin/plan/undo", { page: page.id }).then(function () { return get("/v1/admin/plan/page/" + page.id); })
        .then(function (r) { page.doc = r.doc; page.marks = r.marks; page.canUndo = r.canUndo; page.updated = r.updated; drawPage(false); }).catch(oops);
    });
    root.querySelectorAll("[data-stamp]").forEach(function (b) { b.addEventListener("click", function () { stamping = stamping === b.dataset.stamp ? null : b.dataset.stamp; editing = false; drawPage(false); }); });
    if (!app.dataset.wired) { app.dataset.wired = "1"; app.addEventListener("click", pageClick); }
  }
  function pageClick(e) {
      if (!page || !document.querySelector(".stamp-row")) return;
      var root = app, t = e.target;
      var tag = t.closest(".tag"); if (tag) { e.preventDefault(); saveMark(tag.dataset.tag, tag.dataset.key, { on: false }); return; }
      var ck = t.closest(".ck"); if (ck) { var id = ck.closest("li").dataset.id; saveMark("tick", id, { on: !on("tick", id) }); return; }
      if (stamping && !t.closest("a, summary, button, .editor")) {
        var li = t.closest("ul.checks > li[data-id]"), h2 = t.closest("section.sec > h2");
        if (li) { saveMark(stamping, li.dataset.id, { on: !on(stamping, li.dataset.id) }); return; }
        if (h2) { var k = "sec:" + h2.parentElement.id; saveMark(stamping, k, { on: !on(stamping, k) }); return; }
      }
      if (!editing || t.closest("a, summary, .editor")) return;
      var ed = t.closest("[data-edit]"), sec = t.closest("section.sec");
      var add = t.closest("[data-act=add-point]");
      if (add) { var spot = document.createElement("span"); add.replaceWith(spot);
        openEditor(spot, { value: "", label: "New point", hint: "Use **two stars** around words to make them bold.", save: function (v) { edit({ op: "point-add", section: sec.id, text: v }); } }); return; }
      if (t.closest("[data-act=add-section]")) { var sp = document.createElement("span"); t.closest("[data-act=add-section]").replaceWith(sp);
        openEditor(sp, { value: "", label: "New section heading", single: true, save: function (v) { edit({ op: "section-add", text: v }); } }); return; }
      if (!ed) return;
      var kind = ed.dataset.edit;
      if (kind === "point") {
        var li2 = ed.closest("li"), key = li2.dataset.id, pt = null;
        page.doc.sections.forEach(function (s) { s.points.forEach(function (p) { if (p.id === key) pt = p; }); });
        openEditor(li2.querySelector(".pt-text"), { value: pt.text, label: "Point", hint: "Use **two stars** around words to make them bold.",
          save: function (v) { edit({ op: "point-text", key: key, text: v }); },
          extra: [["Move up", function () { edit({ op: "point-move", key: key, dir: -1 }); }], ["Move down", function () { edit({ op: "point-move", key: key, dir: 1 }); }],
                  ["Note", function () { drawPage(false); noteEditor(document.querySelector('li[data-id="' + key + '"]'), key); }],
                  ["Remove", function () { edit({ op: "point-remove", key: key }); }, "danger"]] });
        return;
      }
      if (kind === "section") {
        var s1 = page.doc.sections.find(function (s) { return s.id === sec.id; });
        openEditor(ed, { value: s1.title, label: "Section heading", single: true, save: function (v) { edit({ op: "section-title", section: sec.id, text: v }); },
          extra: (s1.points.length || (s1.research || []).length) ? [] : [["Remove section", function () { edit({ op: "section-remove", section: sec.id }); }, "danger"]] });
        return;
      }
      if (kind === "intro") { var s2 = page.doc.sections.find(function (s) { return s.id === sec.id; });
        openEditor(ed, { value: (s2.intro || []).join(" "), label: "Line under the heading", allowEmpty: true, save: function (v) { edit({ op: "section-intro", section: sec.id, text: v }); } }); return; }
      if (kind === "name") { openEditor(ed, { value: page.doc.name, label: "Page name", single: true, save: function (v) { edit({ op: "page-name", text: v }); } }); return; }
      if (kind === "blurb") { openEditor(ed, { value: page.doc.blurb || "", label: "Line under the page name", allowEmpty: true, save: function (v) { edit({ op: "page-blurb", text: v }); } }); return; }
  }
  addEventListener("keydown", function (e) { if (e.key === "Escape" && stamping && page) { stamping = null; drawPage(false); } });

  // ---------- overhead view ----------
  function wireOverview(here) {
    var btn = app.querySelector(".ov-open"); if (!btn) return;
    btn.addEventListener("click", function () {
      if (here && page) { var c = counts(), p = overview.pages.find(function (x) { return x.id === here; }); if (p) { p.points = c.t; p.done = c.d; } }
      var total = 0, done = 0; overview.pages.forEach(function (p) { total += p.points; done += p.done; });
      var ov = document.createElement("div"); ov.className = "ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "All 19 pages");
      ov.innerHTML = '<div class="ov-box"><div class="ov-head"><h2 class="ov-title">All 19 pages</h2><span class="ov-all">' + pct(done, total) + "% · " + done + " of " + total + ' points</span><button type="button" class="ov-close">Close</button></div><div class="ov-grid">' +
        groups().map(function (g) {
          return '<div class="ov-group"><div class="ov-gname">' + esc(g.name) + "</div>" + g.pages.map(function (p) {
            var h = p.id === here;
            return '<a class="ov-tile' + (h ? " here" : "") + '" href="#p' + p.id + '"' + (h ? ' aria-current="page"' : "") + '><span class="ov-num">' + parseInt(p.id, 10) + '</span><span class="ov-mid"><span class="ov-name">' + esc(p.name) + "</span>" +
              (h ? '<span class="ov-here">You are here</span>' : "") + '<span class="ov-bar"><i style="width:' + pct(p.done, p.points) + '%"></i></span></span><span class="ov-pct">' + pct(p.done, p.points) + "%</span></a>";
          }).join("") + "</div>";
        }).join("") + '</div><div class="ov-foot">' + (here ? '<a class="ov-front" href="#">Front page</a>' : "") + "<span>Live: every number is up to date.</span></div></div>";
      document.body.appendChild(ov); document.body.classList.add("ov-on");
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches && ov.firstChild.animate) ov.firstChild.animate([{ transform: "scale(1.08)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 240, easing: "ease-out" });
      function close() { ov.remove(); document.body.classList.remove("ov-on"); removeEventListener("keydown", key); }
      function key(e) { if (e.key === "Escape") close(); }
      addEventListener("keydown", key);
      ov.addEventListener("click", function (e) { if (e.target === ov || e.target.closest(".ov-close") || e.target.closest("a")) close(); });
      (ov.querySelector(".ov-tile.here") || ov.querySelector(".ov-close")).focus();
    });
  }

  // ---------- On this page ----------
  var tocHandler = null;
  function wireToc() {
    var toc = app.querySelector(".toc"); if (!toc) return;
    var links = [].slice.call(toc.querySelectorAll("a")), pinned = null;
    toc.addEventListener("click", function (e) {
      var a = e.target.closest("a"); if (!a) return; e.preventDefault(); pinned = a;
      var t = document.getElementById(a.dataset.go); if (t) t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
    function update() {
      var current = null, best = -Infinity;
      links.forEach(function (a) { var el = document.getElementById(a.dataset.go); if (!el) return; var top = Math.round(el.getBoundingClientRect().top); if (top <= 140 && top > best + 2) { best = top; current = a; } });
      current = current || links[0]; if (!current) return;
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) links.forEach(function (a) { var el = document.getElementById(a.dataset.go); if (el && el.getBoundingClientRect().top < innerHeight) current = a; });
      if (pinned) { var el = document.getElementById(pinned.dataset.go); var r = el && el.getBoundingClientRect(); if (r && r.top >= 0 && r.top < innerHeight) current = pinned; }
      links.forEach(function (a) { if (a === current) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
      if (innerWidth <= 900) { toc.scrollLeft = current.offsetLeft - 16; return; }
      var y = current.getBoundingClientRect().top - toc.getBoundingClientRect().top + toc.scrollTop;
      if (y < toc.scrollTop + 30) toc.scrollTop = Math.max(0, y - 30); else if (y > toc.scrollTop + toc.clientHeight - 40) toc.scrollTop = y - toc.clientHeight + 60;
    }
    if (tocHandler) removeEventListener("scroll", tocHandler);
    var ticking = false;
    tocHandler = function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } };
    addEventListener("scroll", tocHandler, { passive: true }); ["wheel", "touchmove"].forEach(function (ev) { addEventListener(ev, function () { pinned = null; }, { passive: true }); });
    update();
  }

  route();
})();
