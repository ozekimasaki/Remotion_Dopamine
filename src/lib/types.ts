// アニメーションモード
// "onset" : 適応閾値ベースのオンセット検出（ドラム/スネアに反応）
// "bpm"   : BPM同期の均等パルス（検出BPMに合わせた規則的な動き）
export type AnimMode = "onset" | "bpm";

// Composition inputProps のスキーマ
export interface BeatSyncInput {
  musicSrc: string; // staticFile参照 (例: "music.mp3")
  characterSrc: string; // staticFile参照 (例: "character.png")
  animMode: AnimMode;   // アニメーションモード
  stripeColors: [string, string]; // ストライプ2色
  stripeAngle: number; // ストライプ角度 (deg, デフォルト: 45)
  stripeWidth: number; // ストライプ幅 (px, デフォルト: 60)
  characterColor: string; // フォールバック色（画像未使用時）
  bounceIntensity: number; // バウンス強度 (0.1〜1.0, デフォルト: 0.5)
}

// 1フレーム分の周波数帯別オーディオデータ（正規化済み 0〜1）
export interface AudioFrameData {
  energy: number; // 全体エネルギー
  bass: number; // 低音 (20-250Hz) → キック/ベース
  mid: number; // 中音 (250-2kHz) → ボーカル/メロディ
  high: number; // 高音 (2k-20kHz) → ハイハット/シンバル
  onset: number; // オンセット強度（エネルギーの急増 = 音の当たり）
}

// BPM解析結果
export interface BeatAnalysisResult {
  bpm: number; // 検出されたBPM
  beatFrames: number[]; // ビートに対応するフレーム番号の配列
  durationInFrames: number; // 合計フレーム数
  frameData: AudioFrameData[]; // フレームごとの周波数帯データ（fpsと同じサンプリングレート）
}

// デフォルト値
export const DEFAULT_INPUT: BeatSyncInput = {
  musicSrc: "music.wav",
  characterSrc: "",
  animMode: "onset",
  stripeColors: ["#ff0066", "#00ccff"],
  stripeAngle: 45,
  stripeWidth: 60,
  characterColor: "#ffffff",
  bounceIntensity: 0.5,
};

// Composition定数
export const COMPOSITION_WIDTH = 1080;
export const COMPOSITION_HEIGHT = 1920;
export const COMPOSITION_FPS = 30;
