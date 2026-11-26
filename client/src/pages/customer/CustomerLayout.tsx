import React from 'react';
import {
  CalendarCheck,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  ShoppingBag,
  Store,
  User,
} from 'lucide-react';
import { DashboardLayout, NavItem } from '../../layouts/DashboardLayout';

const CUSTOMER_NAV: NavItem[] = [
  { label: 'Overview', to: '/customer', icon: LayoutDashboard, end: true },
  { label: 'Browse Products', to: '/customer/catalog', icon: Store },
  { label: 'Booking Cart', to: '/customer/cart', icon: ShoppingBag },
  { label: 'My Bookings', to: '/customer/bookings', icon: CalendarCheck },
  { label: 'Payments & Invoices', to: '/customer/payments', icon: CreditCard },
  { label: 'Profile & Addresses', to: '/customer/profile', icon: User },
  { label: 'Support', to: '/customer/support', icon: LifeBuoy },
];

export function CustomerLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout title={title} navItems={CUSTOMER_NAV}>
      {children}
    </DashboardLayout>
  );
}
