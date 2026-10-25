import "./style.css";
import { TOTAL, PhotoPuzzle } from "./art/puzzle";
import { demoReaders } from "./data/demo";
import { loadEntries, loadReaders, saveReaders } from "./data/repository";
import type { Entry, ReaderPost } from "./data/repository";
import { renderEntryCard, updateCard } from "./ui/cards";

const fmt = new Intl.NumberFormat("ja-JP");
const yen = (n: number) => `¥${fmt.format(n)}`;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

async function main() {
  const entries: Entry[] = await loadEntries();
  const local = loadReaders(); // この端末で入力した読者のアクション
  const demo = new Map(entries.map((e) => [e.id, demoReaders(e.id)]));
  const readersOf = (id: string): ReaderPost[] => [...(demo.get(id) ?? []), ...(local[id] ?? [])];

  /* 四季彩の丘パズル: サイト主・読者が感想を書くたびにピースが1つ埋まる(感想なしの金額だけの入力では埋まらない) */
  const puzzle = new PhotoPuzzle($<HTMLCanvasElement>("#puzzle"));
  const reviewCount = () =>
    entries.reduce((s, e) => s + (e.review ? 1 : 0) + readersOf(e.id).filter((r) => r.review).length, 0);
  const renderPuzzleNote = () => {
    const n = puzzle.count;
    $("#pz-count").textContent = `${n} / ${TOTAL} ピース`;
    $("#pz-left").textContent = n >= TOTAL ? "四季彩の丘の風景が完成しました!" : `完成まで あと ${TOTAL - n} ピース`;
  };

  const renderSummary = () => {
    const all = entries.flatMap((e) => readersOf(e.id));
    const op = entries.reduce((s, e) => s + e.purchase, 0);
    const ot = entries.reduce((s, e) => s + e.tip, 0);
    const rp = all.reduce((s, r) => s + r.purchase, 0);
    const rt = all.reduce((s, r) => s + r.tip, 0);
    $("#s-total").textContent = yen(op + ot + rp + rt);
    $("#s-owner-purchase").textContent = yen(op);
    $("#s-owner-tip").textContent = yen(ot);
    $("#s-reader-purchase").textContent = yen(rp);
    $("#s-reader-tip").textContent = yen(rt);
    $("#list-count").textContent = `${entries.length}件`;
  };
  const refreshCard = (e: Entry) => {
    const li = $("#cards").querySelector<HTMLElement>(`[data-id="${e.id}"]`);
    if (li) updateCard(li, readersOf(e.id));
  };

  /* ダイアログ共通: 外側クリックで閉じる */
  const dialogs = ["#review-dialog", "#readers-dialog", "#action-dialog"].map((s) => $<HTMLDialogElement>(s));
  for (const d of dialogs) d.addEventListener("click", (ev) => ev.target === d && d.close());

  /* サイト主の感想 */
  const reviewDlg = $<HTMLDialogElement>("#review-dialog");
  const openOwnerReview = (e: Entry) => {
    $("#review-text").textContent = e.review;
    reviewDlg.showModal();
  };

  /* 読者の感想(1人ずつ) */
  const readersDlg = $<HTMLDialogElement>("#readers-dialog");
  let viewing: ReaderPost[] = [];
  let pos = 0;
  const showReader = () => {
    const r = viewing[pos];
    $("#r-pos").textContent = `${pos + 1} / ${viewing.length}`;
    $("#r-name").textContent = `${r.name}${r.demo ? "(デモ)" : ""}`;
    $("#r-amounts").textContent = `購入 ${yen(r.purchase)} ・ tips ${yen(r.tip)}`;
    $("#r-text").textContent = r.review;
    $<HTMLButtonElement>("#r-prev").disabled = pos === 0;
    $<HTMLButtonElement>("#r-next").disabled = pos === viewing.length - 1;
  };
  const openReaders = (e: Entry) => {
    viewing = readersOf(e.id).filter((r) => r.review);
    if (!viewing.length) return;
    pos = 0;
    showReader();
    readersDlg.showModal();
  };
  $("#r-prev").addEventListener("click", () => pos > 0 && (pos--, showReader()));
  $("#r-next").addEventListener("click", () => pos < viewing.length - 1 && (pos++, showReader()));
  $("#r-close").addEventListener("click", () => readersDlg.close());

  /* 読者のアクション(購入額・tips額・感想) */
  const actionDlg = $<HTMLDialogElement>("#action-dialog");
  let current: Entry | null = null;
  const openAction = (e: Entry) => {
    current = e;
    $<HTMLFormElement>("#action-form").reset();
    actionDlg.showModal();
  };
  $("#a-cancel").addEventListener("click", () => actionDlg.close());
  const amount = (id: string) => Math.max(0, Math.floor(Number($<HTMLInputElement>(id).value) || 0));
  $<HTMLFormElement>("#action-form").addEventListener("submit", () => {
    if (!current) return;
    const post: ReaderPost = {
      name: $<HTMLInputElement>("#a-name").value.trim() || "あなた",
      review: $<HTMLTextAreaElement>("#a-review").value.trim(),
      purchase: amount("#a-purchase"),
      tip: amount("#a-tip"),
    };
    if (post.purchase + post.tip === 0 && !post.review) return;
    (local[current.id] ??= []).push(post);
    saveReaders(local);
    refreshCard(current);
    renderSummary();
    if (post.review) {
      puzzle.setFilled(reviewCount(), true);
      renderPuzzleNote();
    }
  });

  $("#cards").replaceChildren(
    ...entries.map((e) =>
      renderEntryCard(e, readersOf(e.id), { onOwnerReview: openOwnerReview, onAction: openAction, onReaders: openReaders }),
    ),
  );
  renderSummary();
  puzzle.setFilled(reviewCount());
  renderPuzzleNote();
}

main().catch((err) => {
  console.error(err);
  $("#cards").innerHTML = `<li class="empty-msg">一覧を読み込めませんでした。</li>`;
});
