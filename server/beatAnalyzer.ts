import type { BeatAnalysisResult, AudioFrameData } from "../src/lib/types";

const FFT_SIZE = 2048;

// =============================================
// FFT（Cooley-Tukey iterative radix-2）
// =============================================
function computeFFT(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  // Bit reversal
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }
  // Butterfly operations
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = (-2 * Math.PI) / size;
    for (let i = 0; i < n; i += size) {
      for (let jj = 0; jj < halfSize; jj++) {
        const a = angle * jj;
        const tReal = Math.cos(a) * real[i + jj + halfSize] - Math.sin(a) * imag[i + jj + halfSize];
        const tImag = Math.sin(a) * real[i + jj + halfSize] + Math.cos(a) * imag[i + jj + halfSize];
        real[i + jj + halfSize] = real[i + jj] - tReal;
        imag[i + jj + halfSize] = imag[i + jj] - tImag;
        real[i + jj] += tReal;
        imag[i + jj] += tImag;
      }
    }
  }
}

// =============================================
// 周波数帯別エネルギー計算
// =============================================
function computeBandEnergies(
  channelData: Float32Array,
  sampleRate: number,
  fps: number,
): AudioFrameData[] {
  const hopSize = Math.floor(sampleRate / fps);
  const numFrames = Math.floor((channelData.length - FFT_SIZE) / hopSize);
  const freqPerBin = sampleRate / FFT_SIZE;

  // 周波数帯のビン範囲
  const bassEnd = Math.ceil(250 / freqPerBin);
  const midStart = Math.ceil(250 / freqPerBin);
  const midEnd = Math.ceil(2000 / freqPerBin);
  const highStart = Math.ceil(2000 / freqPerBin);
  const highEnd = Math.min(Math.ceil(20000 / freqPerBin), FFT_SIZE / 2);

  // Hanning窓
  const window = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }

  const rawData: AudioFrameData[] = [];

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    const real = new Float64Array(FFT_SIZE);
    const imag = new Float64Array(FFT_SIZE);

    for (let i = 0; i < FFT_SIZE; i++) {
      real[i] = (channelData[start + i] || 0) * window[i];
    }

    computeFFT(real, imag);

    // 帯域ごとのパワー計算
    let bassE = 0, midE = 0, highE = 0, totalE = 0;
    for (let k = 1; k < FFT_SIZE / 2; k++) {
      const mag = real[k] * real[k] + imag[k] * imag[k];
      totalE += mag;
      if (k >= 1 && k < bassEnd) bassE += mag;
      else if (k >= midStart && k < midEnd) midE += mag;
      else if (k >= highStart && k < highEnd) highE += mag;
    }

    const norm = FFT_SIZE * FFT_SIZE;
    rawData.push({
      energy: totalE / norm,
      bass: bassE / norm,
      mid: midE / norm,
      high: highE / norm,
      onset: 0, // 後でcomputeOnsetStrengthで計算
    });
  }

  // 各帯域を独立に正規化（0〜1）
  for (const key of ["energy", "bass", "mid", "high"] as const) {
    let maxVal = 0;
    for (const d of rawData) {
      if (d[key] > maxVal) maxVal = d[key];
    }
    if (maxVal > 0) {
      for (const d of rawData) {
        d[key] = d[key] / maxVal;
      }
    }
  }

  return rawData;
}

// =============================================
// オンセット強度の計算（適応閾値 + ドラム/スネア検出）
// リズムゲームのノート生成と同じアプローチ:
//   1. スペクトルフラックス（周波数帯別のエネルギー増加）
//   2. 適応閾値（移動平均 × 係数）で小さい音を無視
//   3. 最小間隔で連続検出を防止
//   4. ピーク検出でドラムの「当たり」だけを抽出
// =============================================
function computeOnsetStrength(data: AudioFrameData[]): void {
  if (data.length < 2) return;

  // ステップ1: 周波数帯別のスペクトルフラックス（エネルギー増加量）
  // バンド別に計算することでキック(bass)とスネア(mid)を区別
  const bassFlux: number[] = [];
  const midFlux: number[] = [];
  const highFlux: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      bassFlux.push(0);
      midFlux.push(0);
      highFlux.push(0);
      continue;
    }
    const prev = data[i - 1];
    const curr = data[i];
    bassFlux.push(Math.max(0, curr.bass - prev.bass));
    midFlux.push(Math.max(0, curr.mid - prev.mid));
    highFlux.push(Math.max(0, curr.high - prev.high));
  }

  // ステップ2: 統合フラックス（キック重視: bass * 2.0 + mid * 1.5 + high * 0.5）
  // スネアはmid帯に強いのでmidの重みを上げてスネアも検出しやすくする
  const rawFlux: number[] = [];
  for (let i = 0; i < data.length; i++) {
    rawFlux.push(bassFlux[i] * 2.0 + midFlux[i] * 1.5 + highFlux[i] * 0.5);
  }

  // ステップ3: 正規化
  let maxFlux = 0;
  for (const v of rawFlux) {
    if (v > maxFlux) maxFlux = v;
  }
  if (maxFlux > 0) {
    for (let i = 0; i < rawFlux.length; i++) {
      rawFlux[i] = rawFlux[i] / maxFlux;
    }
  }

  // ステップ4: 曲全体の音量分析 → 適応閾値を自動設定
  // 曲の平均ボリュームから最低閾値を動的に決定（マスター音量に左右されない）
  // ※ rawFluxは正規化済み（max=1.0）なので、分布の形状が曲の特性を表す
  const nonZeroFlux = rawFlux.filter(v => v > 0.001);
  const sortedFlux = [...nonZeroFlux].sort((a, b) => a - b);

  // 中央値: 曲の「普通の」フラックスレベル（背景ノイズの指標）
  const medianFlux = sortedFlux.length > 0
    ? sortedFlux[Math.floor(sortedFlux.length / 2)] : 0.1;
  // 平均値: 曲の全体的なアクティビティレベル
  const meanFlux = nonZeroFlux.length > 0
    ? nonZeroFlux.reduce((a, b) => a + b, 0) / nonZeroFlux.length : 0.1;

  // 適応フロア: 曲の統計から自動算出
  // 中央値の1.8倍を最低ラインに（ノイズをさらに強めに除外）
  // ただし0.15〜0.50の範囲にクリップ（極端な曲でも破綻しないように）
  const adaptiveFloor = Math.max(0.15, Math.min(0.50, medianFlux * 1.8));

  // 適応閾値（リズムゲームのノート判定と同じ仕組み）
  // 過去Nフレームの移動平均 × 係数 = これを超えるフラックスだけが「ヒット」
  const threshWindow = 20; // 過去20フレーム（30fps時 約0.67秒）の移動平均
  const threshMultiplier = 2.5; // 平均の2.5倍以上でヒット判定（厳しめ）
  const minInterval = 3; // 最小3フレーム間隔（リズムゲームの最小ノート間隔）
  const threshold: number[] = [];

  for (let i = 0; i < rawFlux.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - threshWindow); j < i; j++) {
      sum += rawFlux[j];
      count++;
    }
    const avg = count > 0 ? sum / count : meanFlux;
    threshold.push(Math.max(avg * threshMultiplier, adaptiveFloor)); // 曲に応じた適応フロア
  }

  // ステップ5: ピーク検出（閾値超え + ローカルピーク + 最小間隔）
  const peaks: number[] = [];
  let lastPeak = -minInterval;

  for (let i = 1; i < rawFlux.length - 1; i++) {
    if (
      rawFlux[i] > threshold[i] &&
      rawFlux[i] >= rawFlux[i - 1] &&
      rawFlux[i] >= rawFlux[i + 1] &&
      i - lastPeak >= minInterval
    ) {
      peaks.push(i);
      lastPeak = i;
    }
  }

  // ステップ6: ピーク位置にのみonsetを設定 + アタック-ホールド-即減衰包絡
  // ピーク前に攻撃フレームを挿入（「大きくなる」過程を見せる）
  const ATTACK_LEN = 2;    // 攻撃フレーム数
  const HOLD_LEN = 1;        // ホールドフレーム数
  const attackValues = [0.3, 0.7]; // 攻撃中の値（フレーム0, 1）
  const DECAY_VALUE = 0.15;  // 減衰直後の値
  const minPeakGap = ATTACK_LEN + HOLD_LEN + 2; // 最低間隔（包絡が重ならないよう）

  // 最小間隔を満たさないピークを除外
  const filteredPeaks: number[] = [];
  let lastFiltered = -minPeakGap;
  for (const p of peaks) {
    if (p - lastFiltered >= minPeakGap) {
      filteredPeaks.push(p);
      lastFiltered = p;
    }
  }

  // 包絡を直接割り当て（ピーク中心に攻撃→ホールド→即減衰）
  for (const peakFrame of filteredPeaks) {
    // 攻撃フェーズ（ピークの ATTACK_LEN フレーム前から）
    for (let a = 0; a < ATTACK_LEN; a++) {
      const f = peakFrame - ATTACK_LEN + a;
      if (f >= 0 && f < data.length) {
        data[f].onset = attackValues[a];
      }
    }
    // ピーク〜ホールド
    for (let h = 0; h <= HOLD_LEN; h++) {
      const f = peakFrame + h;
      if (f >= 0 && f < data.length) {
        data[f].onset = 1.0;
      }
    }
    // 即減衰（ホールド直後）
    const decayFrame = peakFrame + HOLD_LEN + 1;
    if (decayFrame >= 0 && decayFrame < data.length) {
      data[decayFrame].onset = DECAY_VALUE;
    }
    // それ以降は 0（何もしない＝既に 0）
  }
}

// =============================================
// BPM検出 + 周波数帯データ生成
// =============================================
export async function analyzeBeats(
  audioFilePath: string,
  fps: number,
): Promise<BeatAnalysisResult> {
  const { AudioContext } = await import("node-web-audio-api");
  const audioContext = new AudioContext();

  const fs = await import("node:fs/promises");
  const arrayBuffer = await fs.readFile(audioFilePath);
  const audioBuffer = await audioContext.decodeAudioData(
    arrayBuffer.buffer.slice(
      arrayBuffer.byteOffset,
      arrayBuffer.byteOffset + arrayBuffer.byteLength,
    ),
  );

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // BPM検出（オートコリレーション方式）
  const { bpm, firstOnsetFrame } = detectBpm(audioBuffer);

  // 周波数帯別フレームデータを計算
  const frameData = computeBandEnergies(channelData, sampleRate, fps);

  // オンセット強度を計算（波形ベース、BPM不要）
  computeOnsetStrength(frameData);

  const durationInFrames = Math.ceil(audioBuffer.duration * fps);

  // ビートフレーム配列（実際のオンセット位置から等間隔グリッド）
  const framesPerBeat = (60 / bpm) * fps;
  // 最初のオンセットをビデオのフレーム番号に変換
  const firstOnsetVideoFrame = Math.round((firstOnsetFrame / sampleRate) * fps);
  const beatFrames: number[] = [];
  // 最初のビートから前後にグリッドを展開
  for (let offset = 0; firstOnsetVideoFrame + Math.round(offset * framesPerBeat) < durationInFrames; offset++) {
    beatFrames.push(firstOnsetVideoFrame + Math.round(offset * framesPerBeat));
  }
  // 最初のビートより前にもグリッドを追加（イントロ部分用）
  for (let offset = -1; firstOnsetVideoFrame + Math.round(offset * framesPerBeat) >= 0; offset--) {
    beatFrames.unshift(firstOnsetVideoFrame + Math.round(offset * framesPerBeat));
  }

  audioContext.close();

  return { bpm: Math.round(bpm), beatFrames, durationInFrames, frameData };
}

// =============================================
// BPM検出（オートコリレーション方式）
// 決定論的: 同じ入力 → 必ず同じ出力
// =============================================
function detectBpm(audioBuffer: AudioBuffer): { bpm: number; firstOnsetFrame: number } {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // ステップ1: オンセット検出関数（ODF）を計算
  // 10msフレーム（100Hz）でエネルギー増加量を計算
  const frameSize = Math.floor(sampleRate * 0.01); // 10ms
  const hopSize = Math.floor(frameSize / 2);        // 5ms
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

  const energy: number[] = [];
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    const start = i * hopSize;
    for (let j = 0; j < frameSize; j++) {
      const sample = channelData[start + j] || 0;
      sum += sample * sample;
    }
    energy.push(sum / frameSize);
  }

  // スペクトルフラックス（エネルギー増加のみ）
  const odf: number[] = [0];
  for (let i = 1; i < energy.length; i++) {
    odf.push(Math.max(0, energy[i] - energy[i - 1]));
  }

  if (odf.length < 100) return { bpm: 120, firstOnsetFrame: 0 };

  // ステップ2: オートコリレーション
  // BPM範囲: 60〜200 BPM → 周期: 0.3秒〜1.0秒
  // フレーム数換算（hopSize = 5ms）
  const minLag = Math.floor(0.3 / 0.005);  // 60フレーム (200BPM)
  const maxLag = Math.floor(1.0 / 0.005);  // 200フレーム (60BPM)
  const actualMaxLag = Math.min(maxLag, Math.floor(odf.length / 2));

  // 正規化オートコリレーション
  let meanOdf = 0;
  for (const v of odf) meanOdf += v;
  meanOdf /= odf.length;

  const centered = odf.map(v => v - meanOdf);
  let normFactor = 0;
  for (const v of centered) normFactor += v * v;

  const autocorr: number[] = [];
  for (let lag = minLag; lag <= actualMaxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < odf.length - lag; i++) {
      sum += centered[i] * centered[i + lag];
    }
    autocorr.push(normFactor > 0 ? sum / normFactor : 0);
  }

  // ステップ3: オートコリレーションのピークを探す
  let bestLagIdx = 0;
  let bestVal = -Infinity;
  for (let i = 1; i < autocorr.length - 1; i++) {
    if (autocorr[i] > autocorr[i - 1] && autocorr[i] >= autocorr[i + 1] && autocorr[i] > bestVal) {
      bestVal = autocorr[i];
      bestLagIdx = i;
    }
  }

  const bestLag = bestLagIdx + minLag; // フレーム単位の周期
  const secondsPerBeat = bestLag * 0.005; // 5ms per frame
  let bpm = 60 / secondsPerBeat;

  // BPMを適切な範囲に収める
  while (bpm > 200) bpm /= 2;
  while (bpm < 60) bpm *= 2;

  // ステップ4: 最初のビート位置を決定論的に検出
  // ピーク周期を使って、最もエネルギーが大きい位相を探す
  const beatPeriodFrames = Math.round(60 / bpm / 0.005);
  let bestPhase = 0;
  let bestPhaseEnergy = -Infinity;

  for (let phase = 0; phase < beatPeriodFrames && phase < odf.length; phase++) {
    let phaseEnergy = 0;
    let count = 0;
    for (let i = phase; i < odf.length; i += beatPeriodFrames) {
      phaseEnergy += odf[i];
      count++;
    }
    if (count > 0 && phaseEnergy / count > bestPhaseEnergy) {
      bestPhaseEnergy = phaseEnergy / count;
      bestPhase = phase;
    }
  }

  const firstOnsetFrame = bestPhase * hopSize;

  return { bpm: Math.round(bpm), firstOnsetFrame };
}
