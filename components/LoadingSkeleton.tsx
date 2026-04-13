"use client";

import { useEffect, useState } from "react";

function ShimmerStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes beacon-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .shimmer-block {
        background: linear-gradient(90deg, #f0ebe5 25%, #f7f2ec 50%, #f0ebe5 75%);
        background-size: 200% 100%;
        animation: beacon-shimmer 1.5s infinite;
        border-radius: 8px;
      }
      @keyframes ellipsis-fade {
        0%, 20% { opacity: 0; }
        40%, 100% { opacity: 1; }
      }
    `}} />
  );
}

export function ShimmerBox({
  width,
  height,
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`shimmer-block ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = "60%",
}: {
  lines?: number;
  lastLineWidth?: string;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="shimmer-block"
          style={{
            height: 14,
            width: i === lines - 1 ? lastLineWidth : "100%",
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({
  height = 160,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-cream-200 rounded-xl p-4 ${className}`}>
      <ShimmerBox height={height - 32} width="100%" />
    </div>
  );
}

export function SkeletonChart({
  height = 250,
  className = "",
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-cream-200 rounded-xl p-6 ${className}`}>
      <ShimmerBox height={20} width="40%" className="mb-4" />
      <ShimmerBox height={height - 60} width="100%" />
    </div>
  );
}

export function LoadingEllipsis() {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="text-xs text-ink-300 text-center mt-6">
      Loading data{dots}
    </p>
  );
}

export function PageLoadingSkeleton({
  title,
  sections = 3,
  children,
}: {
  title: string;
  sections?: number;
  children?: React.ReactNode;
}) {
  return (
    <>
      <ShimmerStyles />
      <div>
        <h1 className="font-display text-lg font-semibold text-ink-900 mb-6">
          {title}
        </h1>
        {children || (
          <div className="space-y-4">
            {Array.from({ length: sections }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}
        <LoadingEllipsis />
      </div>
    </>
  );
}
