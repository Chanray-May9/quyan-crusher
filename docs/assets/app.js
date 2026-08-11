/* 蛆言粉碎机 —— 前端主程序。零依赖，零构建。 */
(function () {
  "use strict";

  var API = (window.QY_CONFIG && window.QY_CONFIG.API_BASE || "").replace(/\/+$/, "");
  var DATA = { entries: [], ammo: [], glossary: [], stats: [], bingo: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  var FIRE = { cold: ["冷刀", "f1"], hot: ["热锅", "f2"], table: ["掀桌", "f3"] };

  /* ---------------- toast ---------------- */
  var toastEl, toastTimer;
  function toast(msg) {
    toastEl = toastEl || $("#toast");
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 1600);
  }
  function copy(text) {
    var done = function () { toast("已复制，去糊他脸上"); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, cb) {
    var t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); cb(); } catch (e) { toast("复制失败，手动选中吧"); }
    document.body.removeChild(t);
  }

  /* ---------------- 路由 ---------------- */
  var ROUTES = ["home", "atlas", "detector", "ammo", "bingo", "wall", "stats", "glossary"];
  function route() {
    var id = (location.hash.replace(/^#\/?/, "") || "home").split("?")[0];
    if (ROUTES.indexOf(id) < 0) id = "home";
    $$("section").forEach(function (s) { s.classList.toggle("on", s.id === id); });
    $$("#nav a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#/" + id); });
    if (id === "wall") loadWall();
    window.scrollTo(0, 0);
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    $("#heroMeta").textContent = "档案在册 " + DATA.entries.length + " 条 · 病种 " + cats().length + " 类 · 持续增补";
    // 「今日一蛆」：按当天日期取，一天固定一条
    var d = new Date();
    var seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    var e = DATA.entries[seed % DATA.entries.length];
    $("#today").innerHTML =
      '<div class="cap">今日一蛆 · NO.' + esc(e.id) + " · " + esc(e.cat) + "</div>" +
      '<div class="q">「' + esc(e.quote) + "」</div>" +
      '<div class="d">' + esc(e.decode) + "</div>" +
      '<a class="go" href="#/atlas?e=' + esc(e.id) + '">→ 看拆解和三档回击</a>';
    $("#fBuild").textContent = d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0");
  }

  /* ---------------- 图鉴 ---------------- */
  var curCat = "全部", curQ = "";
  function cats() {
    var seen = [];
    DATA.entries.forEach(function (e) { if (seen.indexOf(e.cat) < 0) seen.push(e.cat); });
    return seen;
  }
  function renderCats() {
    var all = ["全部"].concat(cats());
    $("#cats").innerHTML = all.map(function (c) {
      var n = c === "全部" ? DATA.entries.length : DATA.entries.filter(function (e) { return e.cat === c; }).length;
      return '<button data-c="' + esc(c) + '"' + (c === curCat ? ' class="on"' : "") + ">" + esc(c) + " <span style=opacity:.55>" + n + "</span></button>";
    }).join("");
    $$("#cats button").forEach(function (b) {
      b.onclick = function () { curCat = b.dataset.c; renderCats(); renderList(); };
    });
  }
  function entryHTML(e, open) {
    var fires = ["cold", "hot", "table"].map(function (k) {
      var f = FIRE[k];
      return '<div class="fire ' + f[1] + '"><span class="tag">' + f[0] + '</span>' +
        '<span class="tx">' + esc(e[k]) + "</span>" +
        '<button class="cp" data-cp="' + esc(e[k]) + '">复制</button></div>';
    }).join("");
    return '<article class="card' + (open ? " open" : "") + '" id="e' + esc(e.id) + '">' +
      '<div class="hd"><span class="id">NO.' + esc(e.id) + '</span>' +
      '<span class="t"><span class="q">「' + esc(e.quote) + '」</span><span class="c">' + esc(e.cat) + "</span></span>" +
      '<span class="x">+</span></div>' +
      '<div class="bd">' +
        '<div class="field"><div class="lb">他真正的意思是</div><div class="decode">' + esc(e.decode) + "</div></div>" +
        '<div class="field"><div class="lb">拆 解</div><div class="analysis">' + esc(e.analysis) + "</div></div>" +
        '<div class="field"><div class="lb">反 击 · 三 档</div><div class="fires">' + fires + "</div></div>" +
      "</div></article>";
  }
  function renderList() {
    var q = curQ.trim().toLowerCase();
    var rows = DATA.entries.filter(function (e) {
      if (curCat !== "全部" && e.cat !== curCat) return false;
      if (!q) return true;
      var hay = (e.quote + e.cat + e.decode + e.analysis + e.cold + e.hot + e.table + (e.patterns || []).join("")).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    $("#list").innerHTML = rows.length
      ? rows.map(function (e) { return entryHTML(e, false); }).join("")
      : '<div class="empty">没有匹配的条目。<br>如果他说了一句这里没有的，去「蛆言现场」贴上来。</div>';
    bindCards();
  }
  function bindCards() {
    $$("#list .card .hd").forEach(function (h) {
      h.onclick = function () { h.parentNode.classList.toggle("open"); };
    });
    $$("#list [data-cp]").forEach(function (b) {
      b.onclick = function (ev) { ev.stopPropagation(); copy(b.dataset.cp); };
    });
  }

  /* ---------------- 检测器 ---------------- */
  var VERDICT = [
    { min: 0,  t: "干净",     v: "这段话里没有命中已知蛆言。<strong>但检测器只认它见过的模板</strong>——你要是仍然觉得不舒服，那就是不舒服，不需要一台网页给你盖章。" },
    { min: 1,  t: "轻度",     v: "有一点味儿。这个量级通常还够不上翻脸，但值得当场点一句——<strong>沉默会被读成默许</strong>，而默许会招来下一句更难听的。" },
    { min: 30, t: "中度",     v: "模板化操作已经出现。他说这些话的时候基本没经过脑子，那是几十年攒下来的肌肉记忆。<strong>建议直接抄下面对应条目的「热锅」档。</strong>" },
    { min: 55, t: "重度",     v: "多重命中。这不是一句失言，是一整套完整的话术在运行——<strong>他不是没意识到，他是笃定你不会还嘴。</strong>" },
    { min: 78, t: "蛆窝",     v: "浓度爆表。跟这种人讲道理是浪费你的呼吸。<strong>掀桌档，抄完转身就走，别等他回应。</strong>回应本身就是他想要的。" }
  ];
  function detect(text) {
    var t = String(text || "");
    var flat = t.replace(/[\s,.!?;:，。！？；：、"'「」“”（）()\[\]【】…—\-]/g, "");
    if (!flat) return null;
    var hits = [];
    DATA.entries.forEach(function (e) {
      var n = 0;
      (e.patterns || []).forEach(function (p) {
        var pf = p.replace(/[\s，。！？、]/g, "");
        if (pf && flat.indexOf(pf) >= 0) n++;
      });
      if (n) hits.push({ e: e, n: n });
    });
    if (!hits.length) return { score: 0, hits: [] };
    hits.sort(function (a, b) { return b.n - a.n; });
    var score = 0;
    hits.forEach(function (h, i) { score += (i === 0 ? 32 : 20) + (h.n - 1) * 5; });
    // 同一句里堆的病种越多，越说明是成套的
    var kinds = [];
    hits.forEach(function (h) { if (kinds.indexOf(h.e.cat) < 0) kinds.push(h.e.cat); });
    score += (kinds.length - 1) * 8;
    return { score: Math.min(100, Math.round(score)), hits: hits, kinds: kinds };
  }
  function renderDetect() {
    var r = detect($("#detIn").value);
    var g = $("#gauge");
    if (!r) { g.classList.remove("on"); return; }
    var v = VERDICT[0];
    VERDICT.forEach(function (x) { if (r.score >= x.min) v = x; });
    var rows = r.hits.slice(0, 12).map(function (h) {
      return '<div class="h"><code>NO.' + esc(h.e.id) + "</code><b>「" + esc(h.e.quote) + "」</b>" +
        "<em>" + esc(h.e.cat) + "</em>" +
        '<a href="#/atlas?e=' + esc(h.e.id) + '">看拆解 →</a></div>';
    }).join("");
    g.innerHTML =
      '<div class="num"><b>' + r.score + "</b><span>蛆言指数 · " + v.t + "</span>" +
      "<small>命中 " + r.hits.length + " 条 / " + (r.kinds ? r.kinds.length : 0) + " 个病种</small></div>" +
      '<div class="bar"><i style="width:' + r.score + '%"></i></div>' +
      '<div class="verdict">' + v.v + "</div>" +
      (rows ? '<div class="hits">' + rows + "</div>" : "");
    g.classList.add("on");
  }

  /* ---------------- 弹药库 ---------------- */
  var ammoLv = "all";
  function renderAmmo() {
    var lvs = [["all", "全部"], ["cold", "冷刀"], ["hot", "热锅"], ["table", "掀桌"]];
    $("#ammoF").innerHTML = lvs.map(function (l) {
      return '<button data-l="' + l[0] + '"' + (l[0] === ammoLv ? ' class="on"' : "") + ">" + l[1] + "</button>";
    }).join("");
    $$("#ammoF button").forEach(function (b) {
      b.onclick = function () { ammoLv = b.dataset.l; renderAmmo(); };
    });
    var rows = DATA.ammo.filter(function (a) { return ammoLv === "all" || a.level === ammoLv; });
    $("#ammoList").innerHTML = rows.map(function (a) {
      var f = FIRE[a.level];
      return '<div class="ammo ' + f[1] + '"><span class="tag">' + f[0] + "</span>" +
        '<span class="m"><p>' + esc(a.text) + "</p><small>用在：" + esc(a.use) + "</small></span>" +
        '<button class="cp" data-cp="' + esc(a.text) + '">复制</button></div>';
    }).join("");
    $$("#ammoList [data-cp]").forEach(function (b) { b.onclick = function () { copy(b.dataset.cp); }; });
  }

  /* ---------------- Bingo ---------------- */
  var bgCells = [], bgHit = [];
  function newCard() {
    var pool = DATA.bingo.cells.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    bgCells = pool.slice(0, 24);
    bgCells.splice(12, 0, DATA.bingo.free);
    bgHit = new Array(25).fill(false); bgHit[12] = true;
    drawCard(); $("#bgMsg").textContent = "";
  }
  function drawCard() {
    $("#bgGrid").innerHTML = bgCells.map(function (c, i) {
      return "<div class=\"" + (i === 12 ? "free " : "") + (bgHit[i] ? "hit" : "") + '" data-i="' + i + '">' + esc(c) + "</div>";
    }).join("");
    $$("#bgGrid div").forEach(function (d) {
      d.onclick = function () {
        var i = +d.dataset.i;
        bgHit[i] = !bgHit[i];
        d.classList.toggle("hit", bgHit[i]);
        checkLines();
      };
    });
  }
  function checkLines() {
    var L = [], i;
    for (i = 0; i < 5; i++) { L.push([i*5,i*5+1,i*5+2,i*5+3,i*5+4]); L.push([i,i+5,i+10,i+15,i+20]); }
    L.push([0,6,12,18,24]); L.push([4,8,12,16,20]);
    var n = L.filter(function (l) { return l.every(function (x) { return bgHit[x]; }); }).length;
    var m = $("#bgMsg");
    if (n >= 5) m.textContent = DATA.bingo.bingo[2];
    else if (n >= 2) m.textContent = DATA.bingo.bingo[Math.min(n - 2, 1)];
    else if (n === 1) m.textContent = DATA.bingo.lines[Math.floor(Math.random() * DATA.bingo.lines.length)];
    else m.textContent = "";
  }

  /* ---------------- 数据 / 辞典 ---------------- */
  function renderStats() {
    $("#statList").innerHTML = DATA.stats.map(function (s) {
      return '<div class="stat"><div class="b">' + esc(s.big) + "</div>" +
        '<div class="l">' + esc(s.label) + "</div>" +
        '<div class="k">' + esc(s.kill) + "</div>" +
        '<div class="s">出处：<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.source) + " ↗</a></div></div>";
    }).join("");
  }
  function renderGloss() {
    $("#glossList").innerHTML = DATA.glossary.map(function (g) {
      return '<div class="term"><h4>' + esc(g.term) + "<span>" + esc(g.en) + "</span></h4>" +
        '<p class="d">' + esc(g.def) + "</p>" +
        '<p class="n">' + esc(g.note) + "</p></div>";
    }).join("");
  }

  /* ---------------- 投稿墙 ---------------- */
  var wallSort = "new", wallLoaded = false;
  function likedSet() {
    try { return JSON.parse(localStorage.getItem("qy_liked") || "[]"); } catch (e) { return []; }
  }
  function markLiked(id) {
    var s = likedSet(); if (s.indexOf(id) < 0) s.push(id);
    try { localStorage.setItem("qy_liked", JSON.stringify(s)); } catch (e) {}
  }
  function renderSort() {
    var opts = [["new", "最新"], ["hot", "最多人认同"]];
    $("#wallSort").innerHTML = opts.map(function (o) {
      return '<button data-s="' + o[0] + '"' + (o[0] === wallSort ? ' class="on"' : "") + ">" + o[1] + "</button>";
    }).join("");
    $$("#wallSort button").forEach(function (b) {
      b.onclick = function () { wallSort = b.dataset.s; renderSort(); loadWall(true); };
    });
  }
  function ago(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "刚刚";
    if (s < 3600) return Math.floor(s / 60) + " 分钟前";
    if (s < 86400) return Math.floor(s / 3600) + " 小时前";
    if (s < 2592000) return Math.floor(s / 86400) + " 天前";
    return new Date(ts).toLocaleDateString("zh-CN");
  }
  function loadWall(force) {
    if (wallLoaded && !force) return;
    wallLoaded = true;
    var box = $("#wallList");
    if (!API) {
      box.innerHTML = '<div class="empty">后端还没接上。<br>把 config.js 里的 API_BASE 换成你的 Worker 地址就行。</div>';
      return;
    }
    box.innerHTML = '<div class="empty">正在拉取墙上的内容……</div>';
    fetch(API + "/api/posts?sort=" + wallSort + "&limit=120")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var rows = (d && d.posts) || [];
        if (!rows.length) {
          box.innerHTML = '<div class="empty">墙还是空的。<br>你贴的会是第一条。</div>';
          return;
        }
        var liked = likedSet();
        box.innerHTML = rows.map(function (p) {
          var on = liked.indexOf(p.id) >= 0;
          return '<div class="post"><div class="tx">' + esc(p.text) + "</div><div class=\"ft\">" +
            (p.scene ? '<span class="sc">' + esc(p.scene) + "</span>" : "") +
            "<span>" + ago(p.created_at) + "</span>" +
            '<button class="lk' + (on ? " done" : "") + '" data-id="' + esc(p.id) + '"' + (on ? " disabled" : "") +
            ">我也听过 · <b>" + (p.likes || 0) + "</b></button></div></div>";
        }).join("");
        $$("#wallList .lk").forEach(function (b) {
          b.onclick = function () {
            if (b.disabled) return;
            b.disabled = true; b.classList.add("done");
            var id = b.dataset.id;
            markLiked(id);
            fetch(API + "/api/posts/" + encodeURIComponent(id) + "/like", { method: "POST" })
              .then(function (r) { return r.json(); })
              .then(function (d) { if (d && typeof d.likes === "number") b.innerHTML = "我也听过 · <b>" + d.likes + "</b>"; })
              .catch(function () {});
          };
        });
      })
      .catch(function () {
        box.innerHTML = '<div class="empty">连不上后端。<br>Worker 可能还没部署，或者网络被挡了。</div>';
      });
  }
  function submitPost() {
    var msg = $("#wMsg"), text = $("#wText").value.trim(), scene = $("#wScene").value;
    msg.className = "wall-msg";
    if (text.length < 4) { msg.className = "wall-msg err"; msg.textContent = "太短了，至少写四个字。"; return; }
    if (!API) { msg.className = "wall-msg err"; msg.textContent = "后端没配置，贴不上去。"; return; }
    var btn = $("#wGo"); btn.disabled = true; btn.textContent = "贴上去……";
    fetch(API + "/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, scene: scene })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = "贴上墙";
        if (!res.ok) {
          msg.className = "wall-msg err";
          msg.textContent = (res.d && res.d.error) || "没贴上去，再试一次。";
          return;
        }
        msg.className = "wall-msg ok"; msg.textContent = "上墙了。";
        $("#wText").value = ""; $("#wCnt").textContent = "0 / 600";
        loadWall(true);
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = "贴上墙";
        msg.className = "wall-msg err"; msg.textContent = "网络不通，没发出去。";
      });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    renderHome(); renderCats(); renderList(); renderAmmo(); renderStats(); renderGloss();
    newCard(); renderSort();

    $("#q").oninput = function () { curQ = this.value; renderList(); };
    $("#detGo").onclick = renderDetect;
    $("#detIn").onkeydown = function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") renderDetect(); };
    $("#detDemo").onclick = function () {
      var demos = [
        "你别激动，听我把话说完。我这也是为你好——你一个女生懂什么，这行水很深，跟你说了你也不懂。趁年轻早点生，不然以后是高龄产妇。",
        "小姑娘喝一个嘛，不喝就是不给我面子。我在你这个年纪早就成家了，你这个岁数还不结婚，是不是眼光太高了？我是你长辈，说你两句怎么了。",
        "我支持男女平等的，但你这属于极端女权了。男的也有男的的苦，怎么没人说？别一竿子打死所有人，我就不这样。咱们理性讨论，别带情绪。"
      ];
      $("#detIn").value = demos[Math.floor(Math.random() * demos.length)];
      renderDetect();
    };
    $("#bgNew").onclick = newCard;
    $("#bgClear").onclick = function () {
      bgHit = new Array(25).fill(false); bgHit[12] = true; drawCard(); $("#bgMsg").textContent = "";
    };
    $("#wText").oninput = function () { $("#wCnt").textContent = this.value.length + " / 600"; };
    $("#wGo").onclick = submitPost;

    window.addEventListener("hashchange", function () { route(); jumpEntry(); });
    route(); jumpEntry();
  }
  function jumpEntry() {
    var m = location.hash.match(/[?&]e=(\d+)/);
    if (!m) return;
    curCat = "全部"; curQ = ""; $("#q").value = "";
    renderCats(); renderList();
    var el = $("#e" + m[1]);
    if (el) { el.classList.add("open"); setTimeout(function () { el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60); }
  }

  var files = ["entries", "ammo", "glossary", "stats", "bingo"];
  Promise.all(files.map(function (f) {
    return fetch("assets/data/" + f + ".json").then(function (r) { return r.json(); });
  })).then(function (res) {
    DATA.entries = res[0]; DATA.ammo = res[1]; DATA.glossary = res[2];
    DATA.stats = res[3]; DATA.bingo = res[4];
    boot();
  }).catch(function (e) {
    document.querySelector("main").innerHTML =
      '<div class="empty" style="padding:80px 0">数据没加载出来。<br>如果你是直接双击 index.html 打开的，浏览器会拦住本地读取——<br>用 <code>npx serve docs</code> 起个本地服务器，或者直接看线上版本。</div>';
    console.error(e);
  });
})();
