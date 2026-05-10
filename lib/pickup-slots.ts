export function generatePickupSlots(now: Date): Date[] {
  const slots: Date[] = [];
  const minTime = new Date(now.getTime() + 30 * 60 * 1000);

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);

    for (let hour = 8; hour <= 20; hour++) {
      const minutes = hour < 20 ? [0, 15, 30, 45] : [0];
      for (const minute of minutes) {
        const slot = new Date(day);
        slot.setHours(hour, minute, 0, 0);
        if (slot.getTime() >= minTime.getTime()) {
          slots.push(slot);
        }
      }
    }
  }

  return slots;
}
