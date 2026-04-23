'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface HoverSync {
  hoveredDate: string | null;
  setHoveredDate: (d: string | null) => void;
}

const Ctx = createContext<HoverSync>({ hoveredDate: null, setHoveredDate: () => {} });

export function HoverSyncProvider({ children }: { children: ReactNode }) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  return <Ctx.Provider value={{ hoveredDate, setHoveredDate }}>{children}</Ctx.Provider>;
}

export function useHoverSync(): HoverSync {
  return useContext(Ctx);
}
