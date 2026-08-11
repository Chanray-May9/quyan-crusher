/**
 * 蛆言粉碎机 · 后端
 *
 * 设计原则：不做内容审核。脏话、辱骂、火气，一个字都不过滤——那本来就是这个站的意义。
 * 只保留两道纯技术管道：
 *   1. 频率限制  —— 防机器人把墙刷烂，跟你说什么无关
 *   2. 个人信息拦截 —— 手机号 / 身份证 / 住址 / 邮箱 / 车牌 / 银行卡
 *      不是审查言论，是不想让这面墙变成挂人工具。挂人的法律后果会落到站长头上。
 */

const MAX_LEN = 600;
const MIN_LEN = 4;
const COOLDOWN_SEC = 25;      // 两次投稿最短间隔
const DAILY_LIMIT = 30;       // 每个 IP 每天上限

const SCENES = new Set([
  "饭桌酒局", "办公室", "亲戚长辈", "恋爱婚姻", "网上", "路上/陌生人", "家里", "相亲", "其他"
]);

/* ---------- 个人信息识别 ---------- */
const PII = [
  [/(?:^|[^\d])1[3-9]\d{9}(?:[^\d]|$)/,                               "手机号"],
  [/(?:^|[^\d])(?:\d{17}[\dXx]|\d{15})(?:[^\dXx]|$)/,                 "身份证号"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/,                                        "邮箱"],
  [/(?:^|[^\d])\d{16,19}(?:[^\d]|$)/,                                 "银行卡号"],
  [/[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,5}/, "车牌号"],
  [/[一-龥]{2,12}(?:省|市|区|县|自治州)[一-龥]{0,14}(?:路|街|道|巷|村|镇|大道)[一-龥\dA-Za-z]{0,14}(?:号|栋|幢|单元|室|楼)/, "详细住址"],
  [/(?:微信|QQ|qq|weixin|wechat|VX|vx|威信)\s*[:：号]?\s*[A-Za-z0-9_-]{5,}/,  "社交账号"]
];

function findPII(text) {
  for (const [re, name] of PII) if (re.test(text)) return name;
  return null;
}

/* ---------- 工具 ---------- */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
  });

async function hashIP(ip, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}

function newId() {
  return Date.now().toString(36) + "-" + crypto.randomUUID().slice(0, 8);
}

/* ---------- 路由 ---------- */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/" || path === "/api")            return json({ ok: true, service: "quyan-crusher-api" });
      if (path === "/api/posts" && request.method === "GET")  return listPosts(url, env);
      if (path === "/api/posts" && request.method === "POST") return createPost(request, env);

      const like = path.match(/^\/api\/posts\/([\w.-]+)\/like$/);
      if (like && request.method === "POST") return likePost(like[1], env);

      const del = path.match(/^\/api\/posts\/([\w.-]+)$/);
      if (del && request.method === "DELETE") return deletePost(del[1], request, env);

      if (path === "/api/stats") return statsInfo(env);

      return json({ error: "没这个路径" }, 404);
    } catch (err) {
      return json({ error: "服务器出错了：" + err.message }, 500);
    }
  }
};

/* ---------- 列表 ---------- */
async function listPosts(url, env) {
  const sort = url.searchParams.get("sort") === "hot" ? "hot" : "new";
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));
  const order = sort === "hot" ? "likes DESC, created_at DESC" : "created_at DESC";

  const { results } = await env.DB
    .prepare(`SELECT id, text, scene, likes, created_at FROM posts ORDER BY ${order} LIMIT ?`)
    .bind(limit)
    .all();

  return json({ posts: results || [], sort });
}

/* ---------- 投稿 ---------- */
async function createPost(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "请求格式不对" }, 400); }

  const text = String(body.text || "").trim().replace(/\r\n/g, "\n").slice(0, MAX_LEN + 50);
  let scene = String(body.scene || "").trim();
  if (!SCENES.has(scene)) scene = "";

  if (text.length < MIN_LEN) return json({ error: `太短了，至少 ${MIN_LEN} 个字。` }, 400);
  if (text.length > MAX_LEN) return json({ error: `太长了，最多 ${MAX_LEN} 个字。` }, 400);

  const pii = findPII(text);
  if (pii) {
    return json({
      error: `里面像是有${pii}，没贴上去。删掉那部分再发——这面墙是骂话术的，不是挂人的。`
    }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const ipHash = await hashIP(ip, env.SALT || "quyan");
  const now = Math.floor(Date.now() / 1000);
  const today = Math.floor(now / 86400);

  const row = await env.DB.prepare("SELECT last_at, day, day_cnt FROM rate WHERE ip_hash = ?")
    .bind(ipHash).first();

  if (row) {
    if (now - row.last_at < COOLDOWN_SEC) {
      return json({ error: `慢一点，${COOLDOWN_SEC - (now - row.last_at)} 秒后再发。` }, 429);
    }
    if (row.day === today && row.day_cnt >= DAILY_LIMIT) {
      return json({ error: "今天发得够多了，明天再来。" }, 429);
    }
  }

  const id = newId();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO posts (id, text, scene, likes, created_at, ip_hash) VALUES (?, ?, ?, 0, ?, ?)")
      .bind(id, text, scene || null, Date.now(), ipHash),
    env.DB.prepare(`
      INSERT INTO rate (ip_hash, last_at, day, day_cnt) VALUES (?, ?, ?, 1)
      ON CONFLICT(ip_hash) DO UPDATE SET
        last_at = excluded.last_at,
        day     = excluded.day,
        day_cnt = CASE WHEN rate.day = excluded.day THEN rate.day_cnt + 1 ELSE 1 END
    `).bind(ipHash, now, today)
  ]);

  return json({ ok: true, id });
}

/* ---------- 点赞 ---------- */
async function likePost(id, env) {
  const r = await env.DB.prepare("UPDATE posts SET likes = likes + 1 WHERE id = ? RETURNING likes")
    .bind(id).first();
  if (!r) return json({ error: "这条不在了" }, 404);
  return json({ ok: true, likes: r.likes });
}

/* ---------- 删除（只有你有 token） ---------- */
async function deletePost(id, request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: "没权限" }, 403);
  await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

/* ---------- 概况 ---------- */
async function statsInfo(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(likes),0) AS l FROM posts").first();
  return json({ posts: r.n, likes: r.l });
}
