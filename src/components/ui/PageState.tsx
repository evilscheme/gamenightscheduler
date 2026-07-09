import { LoadingSpinner } from './LoadingSpinner';

/**
 * Full-page centered spinner for route-level loading states (fills the
 * viewport below the 4rem navbar). Optional message renders under the
 * spinner for long-running operations ("Deleting your account…").
 */
export function PageLoading({ message }: { message?: string }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      {message && <p className="text-muted-foreground">{message}</p>}
    </div>
  );
}
