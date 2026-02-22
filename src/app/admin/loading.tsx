import { LoadingSpinner } from '@/components/ui';

export default function Loading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
