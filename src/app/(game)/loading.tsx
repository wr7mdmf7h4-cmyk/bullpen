import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-8" aria-busy aria-label="Loading">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
