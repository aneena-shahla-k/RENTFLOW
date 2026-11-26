# RentFlow — Multi-Tenant Rental Management & Booking SaaS Platform

**Tagline:** *Rent smarter. Manage better.*

RentFlow is a full-stack, multi-tenant MERN + TypeScript SaaS platform built for rental businesses managing cameras, electronics, vehicles, construction gear, event staging, furniture, and machinery.

---

## Architecture & Core Features

- **Strict Multi-Tenant Isolation:** Every company-owned record (`Product`, `Category`, `Booking`, `BookingItem`, `Payment`, `Invoice`, `RentalReturn`, `Delivery`, `MaintenancePeriod`, `Review`, `SupportTicket`, `ActivityLog`, `Subscription`) carries a `companyId`. Tenant context is derived exclusively from the authenticated user's active `CompanyMembership` on the backend—never from client-supplied IDs.
- **Rental Date Boundary & Availability Engine:**
  - All rental dates normalize to UTC calendar day boundaries (`00:00:00.000Z` to `23:59:59.999Z`, inclusive).
  - Two intervals `[A.start, A.end]` and `[B.start, B.end]` overlap iff `A.start <= B.end && A.end >= B.start`.
  - Availability uses a sweep-line peak occupancy algorithm across active bookings, unexpired temporary holds, and scheduled `MaintenancePeriod` blocks, guarded by per-product mutex locks and MongoDB transactions (when running on a replica set).
- **Pricing & Monetary Precision:** All monetary figures are stored and computed in integer smallest currency units (e.g., paise/cents) with configurable company GST/tax rates (inclusive or exclusive), weekly/monthly tiers, delivery charges, and security deposits.
- **Payments & Invoicing:** Razorpay Test Mode integration via `IPaymentGateway` abstraction with backend HMAC-SHA256 signature verification, idempotent duplicate callback handling, and downloadable PDF invoices (`PDFKit`). Includes a clearly labelled **Development Payment Simulator** when Razorpay keys are omitted.
- **Returns & Maintenance Protection:** Late fee calculation, damage charges, refundable deposit settlement, and automatic maintenance locking so damaged units cannot be accidentally re-booked.

---

## Database Relationships

- `User` 1↔1..N `CompanyMembership` N↔1 `Company`
- `Company` 1↔1 `Subscription`
- `Company` 1↔N `Category` (self-referential `parentId` for subcategories)
- `Company` 1↔N `Product` N↔1 `Category`
- `Product` 1↔N `MaintenancePeriod`
- `Customer (User)` 1↔N `Booking` N↔1 `Company`
- `Booking` 1↔N `BookingItem` N↔1 `Product`
- `Booking` 1↔N `Payment`, `Booking` 1↔1 `Invoice`, `Booking` 1↔1 `RentalReturn`, `Booking` 1↔1 `Delivery`
- `Booking` + `Product` + `Customer` → `Review` (requires completed/returned booking)
- `User` / `Company` → `Notification`, `SupportTicket`, `ActivityLog`

---

## Local Setup Instructions

### Prerequisites
- Node.js 20+
- MongoDB 6+ running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example env files:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```
Edit `server/.env` if needed (defaults work out of the box with local MongoDB in development mode).

### 3. Seed Development Demo Data
*(Development environment only — refused in `NODE_ENV=production`)*
```bash
npm run seed
```
To seed only the Super Admin account:
```bash
npm run seed:superadmin
```

### 4. Start Development Servers
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5001/api/health`

---

## Demo Login Credentials (Development Only)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Platform Super Admin** | `superadmin@rentflow.local` | `SuperAdmin@2026!` |
| **Company A Owner** (`Apex Lens & Tech Rentals`) | `owner@apexrentals.local` | `DemoPass!2026` |
| **Company A Admin** | `admin@apexrentals.local` | `DemoPass!2026` |
| **Company A Staff** | `staff1@apexrentals.local` | `DemoPass!2026` |
| **Company B Owner** (`UrbanFleet Tools & Mobility`) | `owner@urbanfleet.local` | `DemoPass!2026` |
| **Customer** | `priya@customer.local` | `DemoPass!2026` |

---

## Running Tests & Production Builds

Run Vitest + Supertest integration tests:
```bash
npm test
```

Build both backend and frontend:
```bash
npm run build
```

---

## Deployment Guide

### Database (MongoDB Atlas)
1. Create a MongoDB Atlas cluster and configure a database user + IP access list.
2. Copy the SRV connection string into `MONGODB_URI`.

### Backend (Render)
1. Create a Web Service pointing to `server/` (or use the included `render.yaml` blueprint).
2. Set `NODE_ENV=production`, `MONGODB_URI`, `CLIENT_URL` (your Vercel URL), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
3. Optionally configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLOUDINARY_*`, and `SMTP_*`.

### Frontend (Vercel)
1. Import the repository into Vercel and set the Root Directory to `client`.
2. Set `VITE_API_URL` to `https://<your-render-service>.onrender.com/api`.
3. `client/vercel.json` handles SPA client-side routing rewrites automatically.
