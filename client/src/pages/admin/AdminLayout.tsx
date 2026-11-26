import React from 'react';
import {
  BarChart3,
  CalendarClock,
  FolderTree,
  LayoutDashboard,
  MessageSquare,
  Package,
  RotateCcw,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import { DashboardLayout, NavItem } from '../../layouts/DashboardLayout';

const ADMIN_NAV: NavItem[] = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Inventory', to: '/admin/inventory', icon: Package },
  { label: 'Categories', to: '/admin/categories', icon: FolderTree },
  { label: 'Bookings', to: '/admin/bookings', icon: CalendarClock },
  { label: 'Returns', to: '/admin/returns', icon: RotateCcw },
  { label: 'Deliveries', to: '/admin/deliveries', icon: Truck },
  { label: 'Customers', to: '/admin/customers', icon: Users },
  { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
  { label: 'Support & Reviews', to: '/admin/support', icon: MessageSquare },
  { label: 'Settings & Billing', to: '/admin/settings', icon: Settings },
];

export function AdminLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout title={title} navItems={ADMIN_NAV}>
      {children}
    </DashboardLayout>
  );
}
