'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useCartStore } from '@/lib/cart-store';
import { priceFormatter } from '@/config/menu';
import CartDrawer from '@/components/(public)/carte/cart-drawer';

function CartFloatingButton() {
  const items = useCartStore((s) => s.items);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => {
    const supps = i.supplements.reduce((s, sup) => s + sup.price, 0);
    return sum + (i.basePrice + supps) * i.quantity;
  }, 0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => setDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-primary px-5 py-3 text-primary-foreground shadow-xl shadow-primary/25 transition-shadow duration-200 hover:shadow-2xl hover:shadow-primary/30"
            aria-label={`Voir le panier, ${totalItems} article${totalItems > 1 ? 's' : ''}`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="text-sm font-semibold">{totalItems}</span>
            <span
              className="h-4 w-px bg-primary-foreground/30"
              aria-hidden="true"
            />
            <span className="text-sm font-semibold">
              {priceFormatter.format(totalPrice)}&nbsp;F
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <CartDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

export default CartFloatingButton;
