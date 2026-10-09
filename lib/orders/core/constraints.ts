import {
  fetchStockSnapshot,
  computeOrderItemsAvailability,
  buildSoldOutLines,
  fetchAdvanceOrderSnapshot,
  maxRequiredAdvanceOrderDays,
  fetchScheduleSnapshot,
  findScheduleBlockedItem,
} from '@/lib/orders/availability';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import { isPickupDateAllowed } from '@/lib/supplements';
import type { CartItem } from '@/lib/cart-store';
import {
  AdvanceOrderRequiredError,
  ScheduleUnavailableError,
  SoldOutTodayError,
} from './errors';

export async function assertPublicOrderConstraints(
  items: CartItem[],
  pickupTime: Date | string | null
): Promise<void> {
  const advanceSnapshot = await fetchAdvanceOrderSnapshot(items);
  const requiredAdvanceDays = maxRequiredAdvanceOrderDays(
    items,
    advanceSnapshot
  );
  if (
    requiredAdvanceDays > 0 &&
    !isPickupDateAllowed(requiredAdvanceDays, pickupTime)
  ) {
    throw new AdvanceOrderRequiredError(requiredAdvanceDays);
  }

  const scheduleSnapshot = await fetchScheduleSnapshot(items);
  const scheduleBlockedItem = findScheduleBlockedItem(
    items,
    scheduleSnapshot,
    pickupTime
  );
  if (scheduleBlockedItem) {
    throw new ScheduleUnavailableError(scheduleBlockedItem.productName);
  }

  if (!isDeferredPickup(pickupTime)) {
    const stock = await fetchStockSnapshot([items]);
    const availability = computeOrderItemsAvailability(items, stock);
    if (!availability.fulfillable) {
      throw new SoldOutTodayError(
        buildSoldOutLines(items, availability.items, stock)
      );
    }
  }
}
