# 蛆言粉碎机 · QUYAN CRUSHER

> 你说的每一句难听话，这里都有编号、有出处、有反击。

中文互联网男拳话术的档案馆。**54 条**常见蛆言，每条都有编号、病种分类、逻辑拆解，以及三档反击话术（冷刀 / 热锅 / 掀桌）。

## 里面有什么

| 板块 | 说明 |
|---|---|
| **蛆言图鉴** | 核心档案库。13 个病种、54 条，可搜索、可按病种过滤 |
| **蛆言检测器** | 粘贴一段话，本地规则引擎给出蛆言指数 + 命中编号 + 病种统计。**全在浏览器里跑，不上传** |
| **弹药库** | 30 条通用回击，按火力分档，一键复制 |
| **爹味 Bingo** | 60 句素材随机抽 5×5，连线有词 |
| **蛆言现场** | 匿名投稿墙。无需注册、无人审核、发了立刻在墙上 |
| **数字不哄你** | 15 条硬数据，全部标注原始出处链接 |
| **黑话辞典** | 20 个词条。叫不出名字的东西没法反抗 |

## 关于「不审核」

投稿墙**不做内容审核**。脏话、辱骂、火气，一个字都不过滤——那本来就是这个站的意义。

后端只保留两道纯技术管道：

1. **频率限制**（25 秒冷却 / 每 IP 每天 30 条）—— 防机器人刷屏，跟你说什么无关
2. **个人信息拦截** —— 手机号、身份证、住址、邮箱、车牌、银行卡、社交账号

第二条不是审查言论，是不想让这面墙变成挂人工具。挂人的法律后果会落到站长头上，不是被挂的人头上。

另有一个只有站长持有 token 的删除接口，用于处理法律层面必须处理的内容。

## 技术架构

零构建，零依赖，零打包。

```
docs/                     静态前端（Cloudflare Pages 与 GitHub Pages 共用同一份）
├── index.html
├── config.js             后端地址，只需改这一处
└── assets/
    ├── style.css
    ├── app.js
    └── data/*.json       全部内容都在这里，改 JSON 即改站
worker/                   Cloudflare Worker + D1
├── src/index.js
├── schema.sql
└── wrangler.toml
```

前端是纯静态文件，`docs/` 目录同时喂给两个托管平台，不需要 CI 构建、不会两边跑偏。两份前端通过 `config.js` 里的 `API_BASE` 指向同一个 Worker，所以投稿墙的内容在两边完全一致。

## 部署

### 后端（Cloudflare Worker + D1）

```bash
cd worker
wrangler d1 create quyan-wall              # 把返回的 database_id 填进 wrangler.toml
wrangler d1 execute quyan-wall --remote --file=./schema.sql
wrangler secret put ADMIN_TOKEN            # 删除接口用，自己想一个
wrangler secret put SALT                   # IP 哈希盐，随便一串随机字符
wrangler deploy
```

部署完把输出的 `*.workers.dev` 地址填进 `docs/config.js`。

### 前端

```bash
# Cloudflare Pages
wrangler pages deploy docs --project-name=quyan-crusher

# GitHub Pages：仓库 Settings → Pages → Source: main 分支 /docs 目录
git push
```

## 加内容

全部内容都在 `docs/assets/data/` 的 JSON 里，不用碰代码。

新增一条蛆言，往 `entries.json` 里加一个对象：

```json
{
  "id": "055",
  "cat": "病种名",
  "quote": "他说的原话",
  "decode": "他真正的意思是（一句话）",
  "analysis": "拆解：这句话在干什么、为什么成立、他图什么",
  "cold": "冷刀档回击",
  "hot": "热锅档回击",
  "table": "掀桌档回击",
  "patterns": ["检测器用的关键词", "可以有多个"]
}
```

`patterns` 会自动被蛆言检测器用上，不需要额外注册。新病种直接写在 `cat` 里，分类筛选器会自己长出来。

## 数据出处

站内所有数据均标注原始链接，可点开核对：

- [国家统计局《2018年全国时间利用调查公报》](https://www.stats.gov.cn/sj/zxfb/202302/t20230203_1900224.html)
- [智联招聘《2024中国女性职场现状调查报告》](https://www.hrloo.com/news/208058.html)
- [第三期中国妇女社会地位调查（中国政府网）](https://www.gov.cn/jrzg/2011-10/21/content_1975297.htm)
- [国务院关于反家庭暴力工作情况的报告（第四期妇女社会地位调查）](http://www.npc.gov.cn/c2/c30834/202309/t20230901_431398.html)
- [南方都市报：320份涉家暴案判决书统计](https://m.mp.oeeee.com/a/BAAFRD000020210302446047.html)

发现数据有误请开 issue。**一个假数字就够他们否定整个站**，所以这部分不能松。

## 许可

内容随便转载、截图、打印、贴墙上，不用署名，不用问。

代码 MIT。
