'use client';

import type { ReactNode, TableHTMLAttributes } from 'react';

/**
 * Shared scaffolding for the admin dashboard's data tables: the horizontal
 * scroll wrapper + base table classes. Row/column shapes differ too much
 * across tabs (sortable headers, expandable rows, pagination, plain lists)
 * to fold into one generic table component, so only this wrapper and the
 * two small pieces below (`AdminTh`, `AdminEmptyRow`) are factored out.
 */
export function AdminTable({
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  );
}

/** Plain (non-sortable) header cell matching every static admin table `<th>`. */
export function AdminTh({
  children,
  align = 'left',
}: {
  children: ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <th className={`${align === 'center' ? 'text-center' : 'text-left'} py-3 px-2 font-medium text-muted-foreground`}>
      {children}
    </th>
  );
}

/** Full-width "no rows" message spanning every column of the table. */
export function AdminEmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}
