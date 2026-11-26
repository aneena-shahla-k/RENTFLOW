import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  ShoppingBag,
  X,
} from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../store/authContext';
import { useCart } from '../store/cartContext';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

export interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

interface DashboardLayoutProps {
  title: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

export function DashboardLayout({ title, navItems, children }: DashboardLayoutProps) {
  const { user, company, logout } = useAuth();
  const { items: cartItems } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data.data as {
        items: Array<{
          _id: string;
          title: string;
          message: string;
          isRead: boolean;
          link?: string;
          createdAt: string;
        }>;
        unreadCount: number;
      };
    },
    refetchInterval: 30000,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const unread = notifData?.unreadCount || 0;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800">
          <Link to="/">
            <Logo light size="sm" />
          </Link>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {company && (
          <div className="mx-3 mt-4 rounded-xl bg-slate-800/70 px-3.5 py-2.5 border border-slate-700/60">
            <p className="text-xs font-bold text-white truncate">{company.name}</p>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>{company.companyCode}</span>
              <span className="capitalize text-brand-300">{user?.companyRole?.replace('_', ' ')}</span>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-soft'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user?.name}</p>
              <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 truncate">{title}</h1>
            {company?.status === 'suspended' && (
              <Badge tone="danger">Workspace Suspended</Badge>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user?.role === 'customer' && (
              <Link
                to="/customer/cart"
                className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ShoppingBag className="h-4 w-4 text-brand-600" />
                <span className="hidden sm:inline">Cart</span>
                {cartItems.length > 0 && (
                  <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {cartItems.length}
                  </span>
                )}
              </Link>
            )}

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-elevated z-50 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-sm font-bold text-slate-900">Notifications</span>
                    {unread > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllMutation.mutate()}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {!notifData?.items?.length ? (
                      <p className="p-6 text-center text-xs text-slate-500">
                        You are all caught up!
                      </p>
                    ) : (
                      notifData.items.map((n) => (
                        <button
                          key={n._id}
                          type="button"
                          onClick={() => {
                            if (!n.isRead) markOneMutation.mutate(n._id);
                            setNotifOpen(false);
                            if (n.link) navigate(n.link);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            n.isRead ? 'bg-white' : 'bg-brand-50/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                            {!n.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-brand-600 shrink-0" />}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{n.message}</p>
                          <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
