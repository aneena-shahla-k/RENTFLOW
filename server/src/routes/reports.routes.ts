import { Router } from 'express';
import {
  exportReportCsv,
  exportReportPdf,
  getBookingsReport,
  getInventoryReport,
  getRevenueReport,
} from '../controllers/reports.controller.js';
import { requireAuth, requireCompanyContext } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();

router.use(requireAuth, requireCompanyContext());
router.get('/revenue', asyncHandler(getRevenueReport));
router.get('/bookings', asyncHandler(getBookingsReport));
router.get('/inventory', asyncHandler(getInventoryReport));
router.get('/export/csv', asyncHandler(exportReportCsv));
router.get('/export/pdf', asyncHandler(exportReportPdf));

export default router;
