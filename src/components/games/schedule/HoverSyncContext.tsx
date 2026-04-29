'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

export type HoverSource = 'cell' | 'row';

interface HoverSync {
  hoveredDate: string | null;
  hoveredFrom: HoverSource | null;
  setHoveredDate: (d: string | null, source?: HoverSource) => void;
}

const Ctx = createContext<HoverSync>({
  hoveredDate: null,
  hoveredFrom: null,
  setHoveredDate: () => {},
});

export function HoverSyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ date: string | null; from: HoverSource | null }>({
    date: null,
    from: null,
  });
  const setHoveredDate = useCallback((d: string | null, source: HoverSource = 'cell') => {
    setState({ date: d, from: d ? source : null });
  }, []);
  return (
    <Ctx.Provider value={{ hoveredDate: state.date, hoveredFrom: state.from, setHoveredDate }}>
      {children}
    </Ctx.Provider>
  );
}

export function useHoverSync(): HoverSync {
  return useContext(Ctx);
}
