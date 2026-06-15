# AGENTS.md — Remotion Dopamine

## プロジェクト概要

音楽のビート（オンセット/BPM）に同期したキャラクターアニメーション動画を生成するRemotionベースのWebアプリケーション。
WebUIから画像+音楽をアップロードし、パラメータを指定してMP4動画をレンダリングする。

## 技術スタック

- **フロントエンド**: React 19 + Remotion 4.0.477 + Tailwind CSS v4
- **サーバー**: Express 5 + Multer (ファイルアップロード)
- **音声解析**: node-web-audio-api (BPM検出 + FFT解析、純粋なTypeScript実装)
- **ビルド/実行**: tsx (サーバー実行), Remotion CLI (レンダリング)
- **言語**: TypeScript (strict モード)

## ディレクトリ構造

```
src/                          # Remotionフロントエンド（ブラウザ側）
  index.ts                    # Remotionルート登録
  Root.tsx                    # Composition定義 + propsスキーマ
  BeatSyncVideo.tsx           # メイン動画コンポーネント
  components/
    Background.tsx            # 斜めストライプ背景（CSS gradient、静止）
    Character.tsx             # キャラクター表示 + アニメーション（scale/offset/sway）
  lib/
    types.ts                  # 型定義（AnimMode, BeatSyncInput, AudioFrameData等）
    beatDetector.ts           # ブラウザ側ビート同期ユーティリティ
    animations.ts             # イージング関数（getBounceScale等）
  index.css                   # Tailwind CSS

server/                       # Express バックエンド（Node.js側）
  index.ts                    # APIサーバー (port 3456)
  renderer.ts                 # レンダリングジョブ管理（非同期exec）
  beatAnalyzer.ts             # BPM検出 + FFT周波数帯解析 + オンセット検出
  public/
    index.html                # WebUI（バニラJS、ライトモード）
    style.css                 # WebUIスタイル（CSS変数ベース）

public/                       # Remotion staticFile配置先（レンダリング時にコピー）
uploads/                      # アップロードファイル一時保存
out/                          # レンダリング出力先（MP4 + 一時props JSON）
scripts/                      # 開発用スクリプト
```

## npmスクリプト

| コマンド | 説明 |
|---|---|
| `npm run dev` | Remotion Studio起動（プレビュー用） |
| `npm run server` | Express APIサーバー起動（http://localhost:3456） |
| `npm run build` | Remotion bundle（ブラウザ側コードのバンドル） |
| `npm run lint` | ESLint + TypeScript型チェック |

## アーキテクチャ

### レンダリングフロー

1. WebUI → `POST /api/render` (FormData: image, music, パラメータ)
2. サーバーがファイルを`uploads/`に保存 → `renderer.ts`でジョブ作成
3. `beatAnalyzer.ts` で音声解析:
   - オートコリレーション方式のBPM検出（60〜200 BPM範囲）
   - FFT（Cooley-Tukey radix-2）による周波数帯別エネルギー計算（bass/mid/high）
   - 適応閾値ベースのオンセット検出（スペクトルフラックス → 移動平均×係数 → ピーク検出）
   - アタック(2f) → ホールド(1f) → 即減衰 の包絡をonsetフィールドに直接書き込み
4. 解析結果（beatFrames, frameData）をJSONファイルに書き出し
5. `npx remotion render` でMP4レンダリング（`--concurrency=2`, タイムアウト15分）
6. 進捗はstderrパース（`Rendering frame N/M`）→ ポーリングAPIでWebUIに通知

### API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/render` | レンダリング開始（multipart/form-data） |
| GET | `/api/render/:id/status` | ジョブ進捗確認（status/progress/bpm） |
| GET | `/api/render/:id/download` | 完成MP4ダウンロード |
| GET | `/api/jobs` | 全ジョブ一覧 |

### アニメーションモード

- **onsetモード（デフォルト）**: サーバー側で適応閾値処理済みのonset値を使用。ドラム/スネアの「当たり」に反応。
- **bpmモード**: 検出BPMに基づく等間隔ビートグリッド。規則的なパルスアニメーション。

両モード共通の包絡: 攻撃(0.3→0.7) → ピーク(1.0) → ホールド → 即減衰(0.15) → 0

### アニメーションパラメータ

- **スケール**: `1 + bass*0.3*intensity + hit*0.3`（最大約1.3倍）
- **Y移動/左右揺れ/回転**: 無効化（0固定）
- **ベース**: bass帯の平滑化値 × bounceIntensity（ゆるやかな呼吸のような動き）
- **transformOrigin**: `center bottom`

## コーディング規約

- **TypeScript strict モード**（noUnusedLocals有効）
- **Prettier**: tabWidth=2, bracketSpacing=true, useTabs=false
- **ESLint**: `@remotion/eslint-config-flat`
- **サーバー/ブラウザ分離**: `server/` はNode.js専用（node-web-audio-api等）、`src/lib/` はブラウザセーフ
- **frameDataのonsetフィールド必須**: JSONシリアライズ時にonsetを含めないとキャラクターが動かない
- **propsはJSONファイル経由**: シェルのクォート問題を避けるため`--props="filepath"`形式
- **エラー文字列化**: `[object Object]`表示を避けるため `err?.message || err?.stderr || String(err)` で処理
- **レンダリングは非同期exec**: `execSync`はサーバーのイベントループをブロックするため使用禁止
- **Windows環境**: `execFileSync`による.cmd実行はEINVALになるため`exec`を使用

## Remotion Composition

- **ID**: `BeatSyncVideo`
- **解像度**: 1080×1920 (縦型 9:16)
- **FPS**: 30
- **期間**: 最後のビートフレーム + 30フレーム

## WebUIデザイン

- ライトモード専用（グレー系ニュートラル + ブランドカラー）
- CSS変数ベースのデザイントークン
- バニラJS（フレームワーク不使用）
- ドラッグ&ドロップ対応
- ストライププレビュー（リアルタイム更新）
- カラープリセット5種 + カスタムカラー2色
