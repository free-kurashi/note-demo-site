// Notion のデータベースから「noteのリンク」「購入額」「tip額」「感想」を読み、public/entries.json に保存する。
// 必要な環境変数: NOTION_TOKEN(インテグレーションのシークレット) / NOTION_DATABASE_ID
// 未設定のときは何もせず、コミット済みの public/entries.json をそのまま使う。
import fs from "node:fs";

const OUT = "public/entries.json";
const PROP = { url: "noteのリンク", purchase: "購入額", tip: "tip額", review: "感想" };
const token = process.env.NOTION_TOKEN;
const dbId = process.env.NOTION_DATABASE_ID;

if (!token || !dbId) {
  console.log("NOTION_TOKEN / NOTION_DATABASE_ID が未設定のため、既存の entries.json を使用します。");
  process.exit(0);
}

const text = (p) => (p?.rich_text ?? p?.title ?? []).map((t) => t.plain_text).join("");
const NOTE_URL = /^https?:\/\/(?:www\.)?note\.com\/([A-Za-z0-9_]+)\/n\/(n[a-z0-9]+)/;

const entries = [];
let cursor;
do {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: JSON.stringify({ page_size: 100, start_cursor: cursor, sorts: [{ timestamp: "created_time", direction: "descending" }] }),
  });
  if (!res.ok) {
    console.error(`Notion API エラー: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  for (const page of data.results) {
    const props = page.properties;
    const raw = props[PROP.url]?.url ?? text(props[PROP.url]);
    const m = String(raw ?? "").trim().match(NOTE_URL);
    if (!m) continue;
    entries.push({
      id: page.id,
      key: m[2],
      url: `https://note.com/${m[1]}/n/${m[2]}`,
      purchase: props[PROP.purchase]?.number ?? 0,
      tip: props[PROP.tip]?.number ?? 0,
      review: text(props[PROP.review]),
    });
  }
  cursor = data.has_more ? data.next_cursor : undefined;
} while (cursor);

fs.mkdirSync("public", { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 1));
console.log(`Notion から ${entries.length} 件を取得しました。`);
