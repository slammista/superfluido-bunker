"use client";

export function SkeletonCard({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`glass rounded-lg p-5 ${className}`}>
      <div className="skeleton mb-4 h-2.5 w-1/3" />
      <div className="skeleton mb-5 h-7 w-2/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton mb-2 h-3.5"
          style={{ width: `${95 - i * 13}%`, animationDelay: `${i * 0.08}s` }}
        />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <div className="skeleton h-2 w-2 shrink-0 rounded-full" />
      <div className="skeleton h-3 flex-1" />
      <div className="skeleton h-2 w-12" />
    </div>
  );
}

export function SkeletonMetric() {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.02] p-5">
      <div className="skeleton mb-3 h-2.5 w-1/2" />
      <div className="skeleton h-10 w-16" />
    </div>
  );
}
