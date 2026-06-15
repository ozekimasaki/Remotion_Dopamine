/**
 * ビート同期アニメーションのイージング関数
 * progress: 0〜1 の進行度（0=ビート直後、1=次のビート直前）
 * intensity: バウンス強度（0〜1）
 */
export function getBounceScale(
  progress: number,
  intensity: number = 0.5
): number {
  // ビート直後に最大スケール、なめらかに1.0に戻る
  const maxScale = 1 + 0.12 * intensity; // 最大1.12倍

  // easeOutCubic: スムーズな減衰（バウンドなし）
  const t = 1 - progress;
  const eased = easeOutCubic(t);

  return 1 + (maxScale - 1) * eased;
}

/**
 * easeOutCubic — なめらかな減衰
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * バウンス時のY軸オフセット（上下移動）
 */
export function getBounceOffsetY(
  progress: number,
  intensity: number = 0.5,
  maxOffset: number = 60
): number {
  const t = 1 - progress;
  const eased = easeOutCubic(t);
  return -maxOffset * intensity * eased * 0.4;
}
