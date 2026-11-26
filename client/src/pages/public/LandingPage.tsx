import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Camera,
  Car,
  Check,
  ChevronDown,
  CreditCard,
  Hammer,
  HardHat,
  Laptop,
  Menu,
  Package,
  PartyPopper,
  ShieldCheck,
  Sofa,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '../../components/common/Logo';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../store/authContext';
import { getHomePathForRole } from '../../routes/ProtectedRoute';

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Date-Aware Booking Engine',
    desc: 'Automatic UTC day-boundary conflict validation prevents double bookings across overlapping reservations and maintenance holds.',
  },
  {
    icon: Package,
    title: 'Multi-Category Inventory',
    desc: 'Track SKUs, stock quantities, conditions, warehouse locations, daily/weekly/monthly pricing, and security deposits.',
  },
  {
    icon: CreditCard,
    title: 'Payments & PDF Invoicing',
    desc: 'Razorpay checkout integration with backend signature verification, GST breakdown, and instant downloadable PDF invoices.',
  },
  {
    icon: Truck,
    title: 'Delivery, Pickup & Returns',
    desc: 'Assign dispatch staff, log return inspections, compute late fees automatically, and track refundable deposits.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Business Analytics',
    desc: 'Monitor revenue trends, fleet utilization, overdue returns, and top-performing equipment from live database aggregations.',
  },
  {
    icon: ShieldCheck,
    title: 'Strict Multi-Tenant Isolation',
    desc: 'Every rental company operates inside an isolated workspace with role-based permissions for owners, admins, and staff.',
  },
];

const SOLUTIONS = [
  { icon: Camera, name: 'Cameras & Cinema Gear', desc: 'Bodies, lenses, gimbals, and studio lighting kits with serial/SKU tracking.' },
  { icon: Laptop, name: 'Laptops & Electronics', desc: 'Workstations, AV rigs, and corporate event hardware fleets.' },
  { icon: Car, name: 'Vehicles & Mobility', desc: 'Cars, vans, bikes, and fleet dispatch with damage check-in.' },
  { icon: HardHat, name: 'Construction Equipment', desc: 'Heavy machinery, scaffolding, and site tools with maintenance windows.' },
  { icon: PartyPopper, name: 'Event & Audio Staging', desc: 'Sound systems, marquees, projectors, and weekend event packages.' },
  { icon: Sofa, name: 'Furniture & Appliances', desc: 'Monthly residential and corporate office staging rentals.' },
  { icon: Hammer, name: 'Tools & Machinery', desc: 'Power tools, generators, and workshop equipment with deposits.' },
];

const FAQS = [
  {
    q: 'How does RentFlow prevent double bookings across overlapping dates?',
    a: 'Every availability check and checkout request runs a server-side sweep-line occupancy check across confirmed bookings, active temporary checkout holds, and scheduled maintenance periods before reserving inventory.',
  },
  {
    q: 'Is each rental company’s inventory and customer data completely isolated?',
    a: 'Yes. Every company-owned record is scoped by a verified companyId derived strictly from the authenticated user’s active company membership on the server.',
  },
  {
    q: 'Can we configure our own GST/tax rules, currency, and delivery fees?',
    a: 'Yes. During the 8-step company onboarding wizard and anytime in Workspace Settings, you can configure tax rates, inclusive vs. exclusive GST, delivery fees, minimum rental duration, and security deposits.',
  },
  {
    q: 'How are payments handled during testing or before Razorpay credentials are added?',
    a: 'RentFlow integrates Razorpay in test mode with backend HMAC signature verification. When test keys are not configured in the environment, a clearly labelled Development Payment Simulator lets you verify end-to-end payment and invoice workflows safely.',
  },
];

export function LandingPage() {
  const { user, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', message: '' });
  const [sendingContact, setSendingContact] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      toast.error('Please fill in your name, email, and message.');
      return;
    }
    setSendingContact(true);
    setTimeout(() => {
      setSendingContact(false);
      toast.success('Enquiry received! Our team will respond shortly.');
      setContactForm({ name: '', email: '', company: '', message: '' });
    }, 450);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 glass-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#home" className="hover:text-slate-900 transition-colors">Home</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#solutions" className="hover:text-slate-900 transition-colors">Solutions</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#about" className="hover:text-slate-900 transition-colors">About</a>
            <a href="#contact" className="hover:text-slate-900 transition-colors">Contact</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated && user ? (
              <Link to={getHomePathForRole(user.role)}>
                <Button size="sm" icon={<ArrowRight className="h-4 w-4" />}>
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden space-y-3">
            <div className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
              <a href="#home" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Home</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Features</a>
              <a href="#solutions" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Solutions</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Pricing</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} className="py-1.5">About</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Contact</a>
            </div>
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              {isAuthenticated && user ? (
                <Link to={getHomePathForRole(user.role)} className="w-full">
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" className="w-full">Login</Button>
                  </Link>
                  <Link to="/register" className="flex-1">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Badge tone="brand" className="mb-5 px-3 py-1">
                 Rent smarter. Manage better.
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl leading-[1.1]">
                Your Entire Rental Business. One Smart Platform.
              </h1>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                Manage inventory, bookings, customers and payments effortlessly with RentFlow.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/register?type=company">
                  <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                    Start Free
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" size="lg">
                    Explore Features
                  </Button>
                </a>
                <Link to="/catalog">
                  <Button variant="ghost" size="lg">
                    Browse Demo Catalog
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Realistic Dashboard Preview (Clearly Labelled Demo UI) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-14 rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-5 shadow-elevated"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 px-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-medium text-slate-500">
                  app.rentflow / workspace-overview
                </span>
              </div>
              <Badge tone="neutral">Illustrative Workspace Preview (Sample Data)</Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-3 rounded-2xl bg-slate-900 p-4 text-white space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Workspace Menu
                </div>
                {['Overview', 'Inventory', 'Bookings', 'Returns', 'Payments', 'Reports'].map(
                  (item, idx) => (
                    <div
                      key={item}
                      className={`rounded-xl px-3 py-2 text-xs font-medium ${
                        idx === 0 ? 'bg-brand-600 text-white' : 'text-slate-300'
                      }`}
                    >
                      {item}
                    </div>
                  )
                )}
              </div>
              <div className="lg:col-span-9 space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Total Products', val: '48 SKUs' },
                    { label: 'Active Bookings', val: '19 Active' },
                    { label: 'Overdue Returns', val: '1 Alert' },
                    { label: 'Monthly Revenue', val: '₹2,48,500' },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5"
                    >
                      <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
                      <p className="mt-1 text-lg font-bold text-slate-900">{kpi.val}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/80 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-700">Date Conflict Guard</span>
                      <Badge tone="success">Active</Badge>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span>Sony FX6 Cinema Kit (10 units)</span>
                        <span className="font-semibold text-emerald-700">6 Free · Jan 3–6</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span>MacBook Pro M3 Max (12 units)</span>
                        <span className="font-semibold text-brand-700">9 Free · Jan 3–6</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-700">Recent Bookings</span>
                      <Badge tone="brand">Live Sync</Badge>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span>RF-2026-1042 · Studio Horizon</span>
                        <span className="font-semibold text-slate-900">Paid</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                        <span>RF-2026-1043 · Apex Events</span>
                        <span className="font-semibold text-amber-700">Pending Approval</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 1. Trusted by Rental Verticals */}
      <section className="border-y border-slate-100 bg-slate-50/60 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Built for modern multi-category rental businesses
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-semibold text-slate-500">
            <span>Cinema & Production Houses</span>
            <span>IT & Workstation Fleets</span>
            <span>Event Staging Operators</span>
            <span>Construction Tool Depots</span>
            <span>Mobility & Fleet Rentals</span>
          </div>
        </div>
      </section>

      {/* 2. Main Platform Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <Badge tone="brand">Platform Capabilities</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything required to run a high-margin rental operation
            </h2>
            <p className="mt-3 text-slate-600">
              Built from the ground up for multi-day reservations, deposit tracking, return inspections, and multi-tenant isolation.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} hover>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3. How RentFlow Works */}
      <section className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <Badge tone="brand" className="bg-brand-500/20 text-brand-200 border-brand-400/30">
              Workflow
            </Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Launch your rental storefront and backoffice in minutes
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-4">
            {[
              { step: '01', title: 'Register & Onboard', desc: 'Create your isolated company workspace and configure tax, deposit, and delivery policies.' },
              { step: '02', title: 'Publish Inventory', desc: 'Add rentable products, stock counts, daily/weekly/monthly rates, and maintenance blocks.' },
              { step: '03', title: 'Accept Bookings & Pay', desc: 'Customers check live date availability, submit carts, and pay via Razorpay with instant invoices.' },
              { step: '04', title: 'Dispatch & Inspect Returns', desc: 'Track deliveries, process return condition reports, refund deposits, and export financial reports.' },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6">
                <span className="text-xs font-bold text-brand-400">STEP {item.step}</span>
                <h3 className="mt-2 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Industry Solutions */}
      <section id="solutions" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Badge tone="brand">Industry Solutions</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Tailored for every rentable asset class
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTIONS.map((s) => (
              <Card key={s.name} hover className="flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900">{s.name}</h3>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{s.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 5, 6, 7. Booking, Inventory & Analytics Previews */}
      <section id="about" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <Badge tone="brand">Booking Management Preview</Badge>
              <h3 className="mt-3 text-lg font-bold text-slate-900">Full Rental Lifecycle</h3>
              <p className="mt-2 text-sm text-slate-600">
                Approve bookings, track payment verification, dispatch deliveries, and monitor overdue returns with complete audit history.
              </p>
              <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex justify-between"><span>Pending Approval</span><span className="font-semibold">Approve / Reject</span></div>
                <div className="flex justify-between"><span>Payment Verified</span><span className="font-semibold text-emerald-700">PDF Invoice Ready</span></div>
                <div className="flex justify-between"><span>Active Rental</span><span className="font-semibold text-brand-700">Return Countdown</span></div>
              </div>
            </Card>
            <Card>
              <Badge tone="success">Inventory Management Preview</Badge>
              <h3 className="mt-3 text-lg font-bold text-slate-900">Live Stock & Maintenance</h3>
              <p className="mt-2 text-sm text-slate-600">
                Track total fleet quantities alongside maintenance windows so damaged units are never accidentally double-booked.
              </p>
              <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex justify-between"><span>SKU Tracking</span><span className="font-semibold">Multi-Image Gallery</span></div>
                <div className="flex justify-between"><span>Low-Stock Alerts</span><span className="font-semibold text-amber-700">Real-Time Thresholds</span></div>
                <div className="flex justify-between"><span>Bulk Actions</span><span className="font-semibold">Status & Archive</span></div>
              </div>
            </Card>
            <Card>
              <Badge tone="info">Analytics Preview</Badge>
              <h3 className="mt-3 text-lg font-bold text-slate-900">Database-Driven Insights</h3>
              <p className="mt-2 text-sm text-slate-600">
                Export CSV and PDF revenue, booking, GST tax, and fleet utilization reports filtered by date range and category.
              </p>
              <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                <div className="flex justify-between"><span>Monthly Revenue</span><span className="font-semibold">Recharts Trends</span></div>
                <div className="flex justify-between"><span>Top Rented Assets</span><span className="font-semibold">Utilization %</span></div>
                <div className="flex justify-between"><span>GST / Tax Summary</span><span className="font-semibold">CSV & PDF Export</span></div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 8. Pricing Plans */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Badge tone="brand">Transparent Pricing</Badge>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Plans built for every stage of rental growth
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Start with a 14-day workspace trial. Upgrade or switch plans anytime.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[
              {
                name: 'Starter',
                price: '₹1,999',
                desc: 'For boutique studios and single-branch shops.',
                features: ['Up to 25 products', '100 bookings / month', '2 staff accounts', 'Date conflict engine', 'PDF invoices'],
                highlighted: false,
              },
              {
                name: 'Professional',
                price: '₹4,999',
                desc: 'For growing rental businesses with active teams.',
                features: ['Up to 200 products', '1,000 bookings / month', '10 staff accounts', 'Advanced analytics & reports', 'Email notifications', 'Return & delivery tracking'],
                highlighted: true,
              },
              {
                name: 'Business',
                price: '₹9,999',
                desc: 'For high-volume, multi-location fleets.',
                features: ['Up to 5,000 products', '25,000 bookings / month', '100 staff accounts', 'Multi-location support', 'CSV & PDF financial exports', 'Priority support SLA'],
                highlighted: false,
              },
            ].map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? 'border-brand-500 ring-2 ring-brand-500/20 relative'
                    : ''
                }
              >
                {plan.highlighted && (
                  <Badge tone="brand" className="mb-3">Most Popular</Badge>
                )}
                <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{plan.desc}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">{plan.price}</span>
                  <span className="text-xs text-slate-500">/ month</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-brand-600 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register?type=company" className="mt-8 block">
                  <Button
                    variant={plan.highlighted ? 'primary' : 'outline'}
                    className="w-full"
                  >
                    Start {plan.name} Trial
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Demo Feedback / Illustrative Testimonials */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <Badge tone="neutral">Illustrative Demo Use Cases</Badge>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                How rental teams organize operations with RentFlow
              </h2>
            </div>
            <span className="text-xs text-slate-500">Demo scenarios for evaluation</span>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                quote: '“Enforcing overlap checks across camera kits and scheduled maintenance windows eliminated manual spreadsheet reconciliation.”',
                author: 'Demo Cinema Rental Operator',
                role: 'Sample Production Workflow',
              },
              {
                quote: '“Customers can check exact date availability, review GST and deposit breakdowns, and download PDF invoices without back-and-forth calls.”',
                author: 'Demo AV & Event Supplier',
                role: 'Sample Event Workflow',
              },
              {
                quote: '“Return inspections let our warehouse staff record missing accessories and deduct late fees directly against security deposits.”',
                author: 'Demo Tool & Machinery Depot',
                role: 'Sample Warehouse Workflow',
              },
            ].map((item) => (
              <Card key={item.author}>
                <p className="text-sm text-slate-700 leading-relaxed">{item.quote}</p>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-900">{item.author}</p>
                  <p className="text-[11px] text-slate-500">{item.role}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 10. FAQ */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge tone="brand">FAQ</Badge>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Frequently asked questions</h2>
          </div>
          <div className="mt-10 space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 11. Contact Section */}
      <section id="contact" className="bg-slate-50 py-20 border-t border-slate-200/70">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 items-start">
            <div>
              <Badge tone="brand">Contact Us</Badge>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">
                Ready to modernize your rental operations?
              </h2>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                Have questions about multi-branch fleets, Razorpay integration, or custom tax rules? Send us a message or launch a free workspace immediately.
              </p>
              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-brand-600" />
                  <span>Multi-tenant workspaces with Owner, Admin & Staff roles</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  <span>JWT authentication & server-side date conflict validation</span>
                </div>
              </div>
            </div>
            <Card>
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Alex Mercer"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="alex@company.com"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                    <input
                      type="text"
                      value={contactForm.company}
                      onChange={(e) => setContactForm((f) => ({ ...f, company: e.target.value }))}
                      placeholder="Horizon Rentals"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
                  <textarea
                    rows={3}
                    value={contactForm.message}
                    onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="Tell us about your rental fleet..."
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <Button type="submit" className="w-full" loading={sendingContact}>
                  Send Message
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </section>

      {/* 12. Footer */}
      <footer className="bg-slate-950 py-12 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <Logo light showTagline />
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#solutions" className="hover:text-white">Solutions</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <Link to="/catalog" className="hover:text-white">Browse Catalog</Link>
            <Link to="/login" className="hover:text-white">Login</Link>
            <Link to="/register" className="hover:text-white">Register</Link>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} RentFlow SaaS Platform.</p>
        </div>
      </footer>
    </div>
  );
}
