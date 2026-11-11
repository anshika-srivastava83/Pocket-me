import React from 'react';

export function PageLoader() {
  return (
    <div className="flex h-screen flex-col gap-4 bg-surface p-4 text-ink">
      <div className="skeleton h-12 w-full" />
      <CardsSkeleton />
    </div>
  );
}

export function CardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 text-ink md:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-24" />
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-3 text-ink">
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton ml-auto h-16 w-1/2" />
      <div className="skeleton h-10 w-3/4" />
    </div>
  );
}