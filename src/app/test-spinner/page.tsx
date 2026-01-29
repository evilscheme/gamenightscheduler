'use client';

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function TestSpinnerPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-foreground">Loading Spinner Test</h1>

        <div className="grid gap-8">
          {/* Size comparison */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Sizes</h2>
            <div className="flex items-end gap-8 p-6 bg-card rounded-lg border">
              <div className="text-center space-y-2">
                <div className="flex justify-center h-16 items-center">
                  <LoadingSpinner size="sm" />
                </div>
                <span className="text-sm text-muted-foreground">sm (24px)</span>
              </div>
              <div className="text-center space-y-2">
                <div className="flex justify-center h-24 items-center">
                  <LoadingSpinner size="md" />
                </div>
                <span className="text-sm text-muted-foreground">md (48px)</span>
              </div>
              <div className="text-center space-y-2">
                <div className="flex justify-center h-28 items-center">
                  <LoadingSpinner size="lg" />
                </div>
                <span className="text-sm text-muted-foreground">lg (96px)</span>
              </div>
            </div>
          </section>

          {/* Dark/Light backgrounds */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">On Different Backgrounds</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-8 bg-white rounded-lg flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
              <div className="p-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            </div>
          </section>

          {/* In context */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">In Context</h2>
            <div className="p-6 bg-card rounded-lg border">
              <div className="flex items-center gap-3">
                <LoadingSpinner size="sm" />
                <span className="text-muted-foreground">Loading your games...</span>
              </div>
            </div>
            <div className="p-12 bg-card rounded-lg border flex flex-col items-center justify-center gap-4">
              <LoadingSpinner size="lg" />
              <span className="text-muted-foreground">Scheduling your game night...</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
