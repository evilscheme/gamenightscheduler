/** Time-of-day options in 30-minute increments for availability selects. */
export function getTimeOptions(use24h: boolean): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      let label: string;
      if (use24h) {
        label = `${h}:${String(m).padStart(2, "0")}`;
      } else {
        const h12 = h % 12 || 12;
        const ampm = h >= 12 ? "PM" : "AM";
        label = m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
      }
      options.push({ value, label });
    }
  }
  return options;
}
