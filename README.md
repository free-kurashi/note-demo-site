# 読了の循環(デモ)

読んだ100円noteを note 公式の埋め込みカードで並べ、読了のたびに「作品」(ジェネラティブアート)が育つサイト。
公開先: https://free-kurashi.github.io/note-demo-site/ (GitHub Pages)。最終的には Cloudflare で公開する予定(後述)。

## いまできること(デモ版)

- note の記事を、note 公式の埋め込み(`https://note.com/embed/notes/<記事ID>` + 公式 `embed.js`)でカード表示
- 各カードの下に、サイト主・読者それぞれの購入額 / tips額(読者は人数つき)を表示
- カードのボタン
  - **noteで開く**: 記事を新しいタブで開く
  - **サイト主の感想**: サイト主の感想を表示
  - **読者の感想 (n)**: 読者の感想を1人ずつ閲覧(◀ 前の人 / 次の人 ▶)
  - **読者のアクション**: 名前(任意)・購入金額・tips額・感想を入力して記録
- トップに「読んだnote」件数、サイト主の購入 / tips、読者の購入 / tips、めぐった合計を表示
- 読者のアクションを記録すると、その記事の作品(キャンバス)に一筆が加わる

> デモ版の制限
> - 記事は `witty_minnow853` の公開記事19件(`public/entries.json`)。購入額・tips額・サイト主の感想は仮の値。
> - 「読者の感想」の一部(各記事1〜3人)はデモ用サンプル(`src/data/demo.ts`、固定シードで毎回同じ)。画面上も「(デモ)」と表示。
> - 読者のアクションの入力は、その人のブラウザ(localStorage)にだけ保存される。**他の人の入力とは合算されない**。

## サイト主の登録(Notion 連携)

Notion にデータベースを作り、次のプロパティを用意する(名前は完全一致)。

| プロパティ名 | 種類 | 内容 |
|---|---|---|
| (任意の名前) | タイトル | メモ用 |
| `noteのリンク` | URL | 例: https://note.com/xxx/n/nxxxxxxxxxxxx |
| `購入額` | 数値 | サイト主が購入した額(円) |
| `tips額` | 数値 | サイト主が贈った tips 額(円)。`tip額` でも可 |
| `感想` | テキスト | サイト主の感想 |

行を追加すると、最大30分後に一覧へ反映される(GitHub Actions が取り込んで再公開)。

### 初回設定(未実施)

1. https://www.notion.so/profile/integrations で「内部インテグレーション」を作成し、シークレットをコピー
2. 作成したデータベースの「…」→「接続」から、そのインテグレーションを追加
3. データベースURLの32桁がデータベースID
4. GitHub のこのリポジトリ → Settings → Secrets and variables → Actions に登録
   - `NOTION_TOKEN` = シークレット
   - `NOTION_DATABASE_ID` = 32桁のID

未設定の間は、コミット済みの `public/entries.json` を表示する(`scripts/sync-notion.mjs` は何もせず終了)。

## 構成

```
index.html               画面の骨組み(ダイアログ含む)
src/main.ts              画面の組み立て・ボタン処理・金額集計
src/ui/cards.ts          カード(埋め込み iframe + 金額 + ボタン)
src/data/repository.ts   データ取得・保存(Entry / ReaderPost の型もここ)
src/data/demo.ts         デモ用の読者の感想
src/art/                 作品のジェネレータ(generator / stage / rng)
scripts/sync-notion.mjs  Notion → public/entries.json
public/entries.json      登録データ(Notion 未接続時の初期データ)
.github/workflows/       GitHub Pages へのデプロイ(30分ごと + push 時)
vite.config.ts           base を /note-demo-site/ に設定(Cloudflare では BASE_PATH=/)
```

データの出し入れは `src/data/repository.ts` に集約してあり、サーバー側に移すときはここを差し替える。

## 開発

```
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に出力
```

## 今後のメモ

### Cloudflare で公開するときの保存先(方針)

| データ | 保存先 | 理由 |
|---|---|---|
| サイト主の記事リンク・購入額・tips額・感想 | **Notion のまま** | サイト主が普段から手で入力する場所。Worker(Pages Functions)が Notion API で読み、短時間キャッシュ(KV など)する |
| 読者の金額・tips・感想 | **Cloudflare D1** | 読者が入力するたびに書き込み、全員分を集計する用途。Notion は書き込み回数・速度の制限があり、読者の入力が直接 Notion に入ってしまうので不向き |

- 構成案: Cloudflare Pages(静的サイト)+ Pages Functions(`/api/entries` = Notion 読み取り、`/api/readers` = D1 読み書き)+ D1。
- D1 の想定テーブル: `reader_posts(id, entry_id, name, review, purchase, tip, created_at)`。トップの合計は `SUM` で集計、カードの人数は `purchase > 0` / `tip > 0` の件数。
- Notion の API トークンは Cloudflare の Secrets に置く(GitHub Pages では秘密鍵を持てないため、移行が必要)。
- KV でも保存できるが、集計が面倒になるため D1 を推奨。
- 移行時の作業: `repository.ts` を API 呼び出しに差し替え → `BASE_PATH=/` でビルド → `wrangler login` / D1 作成 / Secrets 登録 → デプロイ。GitHub Actions の Notion 取り込みは不要になる。

### 公開前に決めること・注意点

- **読者の入力の安全性**: 誰でも送れるため、スパム対策(Cloudflare Turnstile、レート制限)と、文字数・金額の上限チェック、感想の表示時のエスケープが必要。金額は自己申告で、実際に note で購入した保証はない(表示でもそう分かるようにする)。
- **読者の感想の公開範囲・個人情報**: 名前は任意入力。投稿の削除手段(サイト主が管理画面か D1 で削除)を用意する。
- **note の埋め込みと規約**: 現在は自分の記事だけを埋め込んでおり懸念は小さい。他の人の記事を並べる場合は、note の利用規約・ヘルプ(「サイトに貼る」の案内など)を原文で確認し、必要なら note のサポートや著者本人に確認する。規約の原文は、調査時にボット対策で取得できていない(未確認)。
- **note の API は使わない**: `note.com/robots.txt` が `/api/*` を全クローラーに対して Disallow している。記事のタイトル・サムネ・いいね数などは、API やスクレイピングではなく公式の埋め込みに任せる。
- **作品**: 現状は各記事の ID から決まる固定の絵に、読者のアクションで一筆が加わるだけ。D1 に移したあとは、全員分の入力が作品に反映される形にできる。

### 今後の候補

- Notion 連携の初回設定(上記)
- 記事数を増やす(現在19件 / 目標100件)
- Cloudflare への移行と、読者の入力の全員分の集計
