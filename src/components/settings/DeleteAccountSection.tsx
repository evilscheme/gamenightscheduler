'use client';

import Link from 'next/link';
import { Card, CardHeader, CardContent, Button } from '@/components/ui';

export function DeleteAccountSection() {
  return (
    <Card className="mt-6 border-destructive/30 bg-destructive/5">
      <CardHeader>
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Link href="/settings/delete-account">
          <Button variant="danger">Delete Account</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
