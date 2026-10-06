import { Skeleton } from '@/components/ui/skeleton';

const SECTION_HEIGHTS = ['h-64', 'h-72', 'h-96', 'h-96'] as const;

/** Placeholder shown while both profile queries load. */
export default function ProfileSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true" data-testid="profile-skeleton">
      <div className="flex flex-col gap-4">
        {SECTION_HEIGHTS.map((height, index) => (
          <Skeleton key={index} className={`${height} rounded-2xl`} />
        ))}
      </div>
      <Skeleton className="hidden h-96 rounded-2xl lg:block" />
    </div>
  );
}
