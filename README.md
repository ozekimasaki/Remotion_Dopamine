# Remotion Dopamine

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif" width="400">
    </picture>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Remotion-4.0.477-0d84ff?logo=remotion&logoColor=white" alt="Remotion">
  <img src="https://img.shields.io/badge/React-19.2.3-61dafb?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.9.3-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

音楽のビート（オンセット / BPM）に同期したキャラクターアニメーション動画を自動生成する Remotion ベースの Web アプリケーション。

画像と音楽をアップロードするだけで、ドラムやスネアのヒットに反応する縦型 MP4 動画をレンダリングします。

## 主な機能

- **音声解析** — オートコリレーション方式の BPM 検出、FFT による周波数帯別エネルギー計算、適応閾値ベースのオンセット検出
- **ビート同期アニメーション** — オンセット / BPM の 2 モード切替、スケール 1.3 倍までのバウンス表現
- **WebUI** — ドラッグ&ドロップ対応、ストライプ背景プレビュー、カラープリセット 5 種
- **非同期レンダリング** — ジョブキュー管理、進捗ポーリング、MP4 ダウンロード API

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | React 19, Remotion 4.0.477, Tailwind CSS v4 |
| サーバー | Express 5, Multer |
| 音声解析 | node-web-audio-api (BPM + FFT + オンセット) |
| ビルド / 実行 | tsx, Remotion CLI |
| 言語 | TypeScript (strict) |

## クイックスタート

### 依存パッケージのインストール

```bash
npm install
```

### Remotion Studio（プレビュー）

```bash
npm run dev
```

### API サーバー起動（http://localhost:3456）

```bash
npm run server
```

### Remotion bundle

```bash
npm run build
```

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/api/render` | レンダリング開始（`multipart/form-data`） |
| `GET` | `/api/render/:id/status` | ジョブ進捗確認 |
| `GET` | `/api/render/:id/download` | 完成 MP4 ダウンロード |
| `GET` | `/api/jobs` | 全ジョブ一覧 |

## プロジェクト構造

```
src/                  # Remotion フロントエンド（ブラウザ側）
  BeatSyncVideo.tsx   # メイン動画コンポーネント
  components/         # Background, Character
  lib/                # 型定義, アニメーション, ビート検出

server/               # Express バックエンド（Node.js 側）
  index.ts            # API サーバー
  beatAnalyzer.ts     # BPM 検出 + FFT + オンセット検出
  renderer.ts         # レンダリングジョブ管理
  public/             # WebUI（index.html, style.css）
```

## アニメーションモード

- **onset モード（デフォルト）** — 適応閾値処理済みのオンセット値でドラム / スネアの「当たり」に反応
- **bpm モード** — 検出 BPM に基づく等間隔ビートグリッドで規則的なパルスアニメーション

## ライセンス

[Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) に準じます。  
Remotion は個人・小規模チーム向けに無料、企業利用には有料ライセンスが必要です。
