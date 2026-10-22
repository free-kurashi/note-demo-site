const READERS_KEY = "yomi-readers-v2";

/** サイト主が Notion のデータベースに入力した1行 */
export interface Entry {
  id: string;
  key: string;
  url: string;
  purchase: number; // サイト主の購入額
  tip: number; // サイト主のtips額
  review: string; // サイト主の感想
}

/** 読者のアクション(購入額・tips額・感想)。サイト主の金額とは別に集計する */
export interface ReaderPost {
  name: string;
  review: string;
  purchase: number;
  tip: number;
  demo?: boolean;
}

// 将来 Cloudflare Workers + D1 に差し替える場合はこの層だけを置き換える。
export async function loadEntries(): Promise<Entry[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}entries.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`entries.json: HTTP ${res.status}`);
  return (await res.json()).entries;
}

export function loadReaders(): Record<string, ReaderPost[]> {
  try {
    return JSON.parse(localStorage.getItem(READERS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveReaders(v: Record<string, ReaderPost[]>): void {
  try {
    localStorage.setItem(READERS_KEY, JSON.stringify(v));
  } catch {
    /* 保存できない環境では、そのセッションだけ有効 */
  }
}
