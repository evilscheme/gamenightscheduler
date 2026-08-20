import { LoadingSpinner } from './LoadingSpinner';
import { Button } from './Button';
import { Card, CardContent } from './Card';

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

/**
 * Full-page error state for a route whose data failed to load, with an
 * optional retry. Counterpart to PageLoading: a failed fetch keeps the user
 * where they are and offers a way forward, rather than redirecting them
 * somewhere that implies their data is gone.
 */
export function PageError({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-8 text-center space-y-4">
          <p className="text-danger font-medium">{title}</p>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {onRetry && (
            <Button variant="secondary" onClick={onRetry} disabled={retrying}>
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
