"use client";

import { useEffect, useRef } from "react";

type AudioVisualizerProps = {
  audioLevel: number;
  className?: string;
};

const BAR_COUNT = 36;

export function AudioVisualizer({ audioLevel, className }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(height * pixelRatio));
    context.scale(pixelRatio, pixelRatio);
    context.clearRect(0, 0, width, height);

    const centerY = height / 2;
    const gap = 4;
    const barWidth = Math.max(2, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);
    const normalizedLevel = Math.max(0, Math.min(100, audioLevel)) / 100;

    context.fillStyle = "rgba(15, 23, 42, 0.08)";
    context.fillRect(0, 0, width, height);

    for (let index = 0; index < BAR_COUNT; index += 1) {
      const position = index / Math.max(1, BAR_COUNT - 1);
      const wave = 0.35 + Math.abs(Math.sin(position * Math.PI * 2.5)) * 0.65;
      const barHeight = Math.max(4, height * normalizedLevel * wave);
      const x = index * (barWidth + gap);
      const y = centerY - barHeight / 2;

      context.fillStyle = normalizedLevel > 0.05 ? "rgb(37, 99, 235)" : "rgb(148, 163, 184)";
      context.fillRect(x, y, barWidth, barHeight);
    }
  }, [audioLevel]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="实时音频波形"
      className={className ?? "h-20 w-full rounded-md border border-slate-200 bg-white"}
    />
  );
}
