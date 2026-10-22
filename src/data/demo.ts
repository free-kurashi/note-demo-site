import { hash, mulberry32 } from "../art/rng";
import type { ReaderPost } from "./repository";

// デモ用の読者の感想。記事ごとに固定シードで毎回同じ内容になる。
const NAMES = ["みどり", "ゆう", "そら", "はると", "かなえ", "りく", "ことは", "あおい"];
const REVIEWS = [
  "紹介から読みに来ました。最後まで一気に読んで、胸があたたかくなりました。",
  "ずっと言葉にできなかった気持ちが、ここに書いてあって驚きました。",
  "100円でこんなに心が動くなんて。ありがとうございます。",
  "読み終えてから、散歩に出たくなりました。いい時間でした。",
  "少しだけ、自分にも優しくしようと思えました。",
  "友人にも送りました。きっと同じところで立ち止まると思います。",
  "何度か読み返しています。そのたびに違う一文が残ります。",
  "静かなのに、ちゃんと届く文章でした。tipsを贈らせてください。",
];

export function demoReaders(entryId: string): ReaderPost[] {
  const rnd = mulberry32(hash(`demo-${entryId}`));
  const count = 1 + Math.floor(rnd() * 3);
  return Array.from({ length: count }, () => ({
    name: NAMES[Math.floor(rnd() * NAMES.length)],
    review: REVIEWS[Math.floor(rnd() * REVIEWS.length)],
    purchase: rnd() < 0.8 ? 100 : 0,
    tip: [0, 0, 100, 300, 500][Math.floor(rnd() * 5)],
    demo: true,
  }));
}
