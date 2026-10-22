import type { Entry, ReaderPost } from "../data/repository";

const fmt = new Intl.NumberFormat("ja-JP");
const yen = (n: number) => `¥${fmt.format(n)}`;

export interface CardHandlers {
  onOwnerReview: (entry: Entry) => void;
  onAction: (entry: Entry) => void;
  onReaders: (entry: Entry) => void;
}

/** note 公式の埋め込み(https://note.com/scripts/embed.js が iframe の高さを調整する) */
function embedFrame(key: string): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.className = "note-embed";
  frame.src = `https://note.com/embed/notes/${key}`;
  frame.loading = "lazy";
  frame.title = "noteの記事カード";
  frame.height = "400";
  return frame;
}

function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${cls}`;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

export function renderEntryCard(e: Entry, readers: ReaderPost[], h: CardHandlers): HTMLElement {
  const li = document.createElement("li");
  li.className = "card";
  li.dataset.id = e.id;

  const sums = document.createElement("p");
  sums.className = "sums";

  const open = document.createElement("a");
  open.className = "btn open";
  open.href = e.url;
  open.target = "_blank";
  open.rel = "noopener";
  open.textContent = "noteで開く ↗";

  const ownerReview = button("サイト主の感想", "review", () => h.onOwnerReview(e));
  ownerReview.disabled = !e.review;
  ownerReview.title = e.review ? "" : "感想はまだありません";

  const foot = document.createElement("div");
  foot.className = "card-foot";
  foot.append(
    open,
    ownerReview,
    button("読者の感想", "readers", () => h.onReaders(e)),
    button("読者のアクション", "action", () => h.onAction(e)),
  );

  li.append(embedFrame(e.key), sums, foot);
  updateCard(li, e, readers);
  return li;
}

/** カード下の金額表示と「読者の感想」の人数を更新 */
export function updateCard(li: HTMLElement, e: Entry, readers: ReaderPost[]): void {
  const buyers = readers.filter((r) => r.purchase > 0);
  const tippers = readers.filter((r) => r.tip > 0);
  const total = (xs: ReaderPost[], f: (r: ReaderPost) => number) => xs.reduce((s, r) => s + f(r), 0);
  li.querySelector<HTMLElement>(".sums")!.innerHTML =
    `<dl><dt>サイト主</dt><dd>購入 ${yen(e.purchase)}</dd><dd>tips ${yen(e.tip)}</dd></dl>` +
    `<dl class="v"><dt>読者</dt><dd>購入 ${yen(total(buyers, (r) => r.purchase))}(${buyers.length}人)</dd>` +
    `<dd>tips ${yen(total(tippers, (r) => r.tip))}(${tippers.length}人)</dd></dl>`;
  const btn = li.querySelector<HTMLButtonElement>(".readers")!;
  btn.textContent = `読者の感想 (${readers.filter((r) => r.review).length})`;
  btn.disabled = readers.every((r) => !r.review);
}
