import React, { createContext, useContext, useState } from 'react';
import { Product } from '../types';

export interface CartItem {
  product: Product;
  quantity: number;
  startDate: string;
  endDate: string;
}

interface CartContextValue {
  items: CartItem[];
  companyId: string | null;
  addItem: (item: CartItem) => { ok: boolean; error?: string };
  removeItem: (productId: string) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const firstCompany = items[0]?.product.companyId;
  const companyId = firstCompany
    ? typeof firstCompany === 'string'
      ? firstCompany
      : firstCompany._id
    : null;

  const addItem = (newItem: CartItem): { ok: boolean; error?: string } => {
    const newCompanyId =
      typeof newItem.product.companyId === 'string'
        ? newItem.product.companyId
        : newItem.product.companyId._id;

    if (companyId && companyId !== newCompanyId) {
      return {
        ok: false,
        error:
          'Your cart contains equipment from another rental company. Clear your cart or checkout first.',
      };
    }

    if (items.length > 0 && (items[0].startDate !== newItem.startDate || items[0].endDate !== newItem.endDate)) {
      return {
        ok: false,
        error:
          'All items in a single booking must share the same rental start and end dates.',
      };
    }

    setItems((prev) => {
      const existing = prev.find((i) => i.product._id === newItem.product._id);
      if (existing) {
        return prev.map((i) =>
          i.product._id === newItem.product._id ? { ...i, quantity: newItem.quantity } : i
        );
      }
      return [...prev, newItem];
    });
    return { ok: true };
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.product._id !== productId));
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product._id === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider
      value={{
        items,
        companyId,
        addItem,
        removeItem,
        updateItemQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
