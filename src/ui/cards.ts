import type { Entry, ReaderPost } from "../data/repository";

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

  li.append(embedFrame(e.key), foot);
  updateCard(li, readers);
  return li;
}

/** 「読者の感想」ボタンの人数を更新(金額はカードには出さず、トップの合計だけに使う) */
export function updateCard(li: HTMLElement, readers: ReaderPost[]): void {
  const btn = li.querySelector<HTMLButtonElement>(".readers")!;
  btn.textContent = `読者の感想 (${readers.filter((r) => r.review).length})`;
  btn.disabled = readers.every((r) => !r.review);
}
