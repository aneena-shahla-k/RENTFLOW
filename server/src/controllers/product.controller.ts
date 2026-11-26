import { Response } from 'express';
import { Category } from '../models/Category.js';
import { Company } from '../models/Company.js';
import { MaintenancePeriod } from '../models/MaintenancePeriod.js';
import { Product } from '../models/Product.js';
import { Subscription } from '../models/Subscription.js';
import { logActivity } from '../services/activity.service.js';
import { checkProductAvailabilityForRange } from '../services/availability.service.js';
import { uploadImageBuffer } from '../services/storage.service.js';
import { AuthRequest, SUBSCRIPTION_PLANS } from '../types/index.js';
import { normalizeRentalRange } from '../utils/dateRange.js';
import { AppError } from '../utils/errors.js';
import { escapeRegex } from '../utils/sanitize.js';

export async function listAdminProducts(req: AuthRequest, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const categoryId = String(req.query.categoryId || '').trim();
  const sortParam = String(req.query.sort || '-createdAt');

  const filter: Record<string, unknown> = { companyId: req.companyId };
  if (status) filter.status = status;
  if (categoryId) filter.categoryId = categoryId;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { brand: rx }, { model: rx }];
  }

  const allowedSorts: Record<string, Record<string, 1 | -1>> = {
    '-createdAt': { createdAt: -1 },
    createdAt: { createdAt: 1 },
    pricePerDay: { pricePerDay: 1 },
    '-pricePerDay': { pricePerDay: -1 },
    name: { name: 1 },
    totalStock: { totalStock: -1 },
  };
  const sort = allowedSorts[sortParam] || { createdAt: -1 };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('categoryId', 'name slug')
      .populate('subcategoryId', 'name slug')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
}

export async function listPublicProducts(req: AuthRequest, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));
  const search = String(req.query.search || '').trim();
  const categoryId = String(req.query.categoryId || '').trim();
  const companyId = String(req.query.companyId || '').trim();
  const categoryName = String(req.query.category || '').trim();
  const sortParam = String(req.query.sort || '-createdAt');

  const approvedCompanies = await Company.find({ status: 'approved' }).select('_id');
  const approvedCompanyIds = approvedCompanies.map((c) => c._id);

  const filter: Record<string, unknown> = {
    status: 'active',
    companyId: { $in: approvedCompanyIds },
  };

  if (companyId) filter.companyId = companyId;
  if (categoryId) filter.categoryId = categoryId;
  if (categoryName) {
    const cats = await Category.find({ name: new RegExp(escapeRegex(categoryName), 'i') }).select('_id');
    filter.categoryId = { $in: cats.map((c) => c._id) };
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { description: rx }, { brand: rx }, { sku: rx }];
  }

  const allowedSorts: Record<string, Record<string, 1 | -1>> = {
    '-createdAt': { createdAt: -1 },
    pricePerDay: { pricePerDay: 1 },
    '-pricePerDay': { pricePerDay: -1 },
    '-averageRating': { averageRating: -1 },
  };
  const sort = allowedSorts[sortParam] || { createdAt: -1 };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate(
        'companyId',
        'name slug companyCode logoUrl address.city address.state settings.currency settings.currencySymbol settings.deliveryEnabled settings.defaultDeliveryFee settings.taxEnabled settings.taxRate settings.taxInclusive settings.securityDepositRequired'
      )
      .populate('categoryId', 'name slug')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    },
  });
}

export async function getProductById(req: AuthRequest, res: Response): Promise<void> {
  const product = await Product.findById(req.params.id)
    .populate(
      'companyId',
      'name slug companyCode logoUrl address settings status'
    )
    .populate('categoryId', 'name slug')
    .populate('subcategoryId', 'name slug');

  if (!product) {
    throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  // Enforce strict tenant isolation when accessed by any company role
  if (
    req.user &&
    ['company_owner', 'company_admin', 'rental_staff'].includes(req.user.role)
  ) {
    if (!req.companyId || product.companyId._id.toString() !== req.companyId.toString()) {
      throw new AppError('Product not found in your company workspace.', 404, 'PRODUCT_NOT_FOUND');
    }
  } else if (product.status !== 'active') {
    throw new AppError('Product is not currently available.', 404, 'PRODUCT_NOT_FOUND');
  }

  const maintenancePeriods = await MaintenancePeriod.find({
    productId: product._id,
    status: { $in: ['scheduled', 'in_progress'] },
    endDate: { $gte: new Date() },
  }).sort({ startDate: 1 });

  res.json({
    success: true,
    data: {
      product,
      maintenancePeriods,
    },
  });
}

export async function createProduct(req: AuthRequest, res: Response): Promise<void> {
  // Enforce subscription product limit
  const subscription = await Subscription.findOne({ companyId: req.companyId });
  const planId = subscription?.plan || 'starter';
  const maxProducts = SUBSCRIPTION_PLANS[planId].limits.maxProducts;
  const currentCount = await Product.countDocuments({
    companyId: req.companyId,
    status: { $ne: 'archived' },
  });

  if (currentCount >= maxProducts) {
    throw new AppError(
      `Your ${SUBSCRIPTION_PLANS[planId].name} plan supports up to ${maxProducts} active products. Upgrade your plan to add more.`,
      403,
      'PLAN_LIMIT_REACHED'
    );
  }

  const category = await Category.findOne({
    _id: req.body.categoryId,
    companyId: req.companyId,
  });
  if (!category) {
    throw new AppError('Selected category does not belong to your company.', 400, 'INVALID_CATEGORY');
  }

  const availableStock =
    req.body.availableStock !== undefined
      ? Math.min(req.body.availableStock, req.body.totalStock)
      : req.body.totalStock;

  const product = await Product.create({
    ...req.body,
    companyId: req.companyId,
    availableStock,
  });

  await logActivity({
    companyId: req.companyId,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'PRODUCT_CREATED',
    resourceType: 'Product',
    resourceId: product._id.toString(),
    description: `Created product "${product.name}" (SKU: ${product.sku})`,
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Product created successfully.',
    data: product,
  });
}

export async function updateProduct(req: AuthRequest, res: Response): Promise<void> {
  const product = await Product.findOne({
    _id: req.params.id,
    companyId: req.companyId,
  });
  if (!product) {
    throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  if (req.body.categoryId) {
    const category = await Category.findOne({
      _id: req.body.categoryId,
      companyId: req.companyId,
    });
    if (!category) {
      throw new AppError('Selected category does not belong to your company.', 400, 'INVALID_CATEGORY');
    }
  }

  Object.assign(product, req.body);
  if (product.availableStock > product.totalStock) {
    product.availableStock = product.totalStock;
  }
  await product.save();

  await logActivity({
    companyId: req.companyId,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'PRODUCT_UPDATED',
    resourceType: 'Product',
    resourceId: product._id.toString(),
    description: `Updated product "${product.name}" (SKU: ${product.sku})`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Product updated successfully.',
    data: product,
  });
}

export async function deleteProduct(req: AuthRequest, res: Response): Promise<void> {
  const product = await Product.findOneAndDelete({
    _id: req.params.id,
    companyId: req.companyId,
  });
  if (!product) {
    throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  await logActivity({
    companyId: req.companyId,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'PRODUCT_DELETED',
    resourceType: 'Product',
    resourceId: product._id.toString(),
    description: `Deleted product "${product.name}" (SKU: ${product.sku})`,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: 'Product deleted.' });
}

export async function bulkUpdateProductStatus(req: AuthRequest, res: Response): Promise<void> {
  const { productIds, status } = req.body;
  const result = await Product.updateMany(
    { _id: { $in: productIds }, companyId: req.companyId },
    { $set: { status } }
  );

  res.json({
    success: true,
    message: `Updated ${result.modifiedCount} product(s) to ${status}.`,
    data: { modifiedCount: result.modifiedCount },
  });
}

export async function uploadProductImages(req: AuthRequest, res: Response): Promise<void> {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw new AppError('Please attach at least one image file.', 400, 'NO_FILES');
  }

  const uploadedUrls: string[] = [];
  for (const file of files) {
    const { url } = await uploadImageBuffer(
      file.buffer,
      file.mimetype,
      `rentflow/products/${req.companyId}`
    );
    uploadedUrls.push(url);
  }

  res.json({
    success: true,
    message: 'Images uploaded.',
    data: { urls: uploadedUrls },
  });
}

export async function getProductAvailabilityOverview(req: AuthRequest, res: Response): Promise<void> {
  const product = await Product.findOne({
    _id: req.params.id,
    companyId: req.companyId,
  });
  if (!product) {
    throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  const start = req.query.startDate
    ? String(req.query.startDate)
    : new Date().toISOString().slice(0, 10);
  const end = req.query.endDate
    ? String(req.query.endDate)
    : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const availability = await checkProductAvailabilityForRange({
    productId: product._id,
    startDate: start,
    endDate: end,
    requestedQuantity: 1,
  });

  const maintenancePeriods = await MaintenancePeriod.find({
    productId: product._id,
    companyId: req.companyId,
  }).sort({ startDate: -1 });

  res.json({
    success: true,
    data: {
      availability,
      maintenancePeriods,
    },
  });
}

export async function addMaintenancePeriod(req: AuthRequest, res: Response): Promise<void> {
  const product = await Product.findOne({
    _id: req.params.id,
    companyId: req.companyId,
  });
  if (!product) {
    throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
  }

  const { startDate, endDate } = normalizeRentalRange(req.body.startDate, req.body.endDate);
  if (req.body.quantityBlocked > product.totalStock) {
    throw new AppError('Quantity blocked cannot exceed total product stock.', 400, 'INVALID_QUANTITY');
  }

  const period = await MaintenancePeriod.create({
    companyId: req.companyId,
    productId: product._id,
    startDate,
    endDate,
    quantityBlocked: req.body.quantityBlocked,
    reason: req.body.reason,
    createdBy: req.user!._id,
  });

  res.status(201).json({
    success: true,
    message: 'Maintenance period scheduled.',
    data: period,
  });
}

export async function cancelMaintenancePeriod(req: AuthRequest, res: Response): Promise<void> {
  const period = await MaintenancePeriod.findOneAndUpdate(
    { _id: req.params.periodId, companyId: req.companyId },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
  if (!period) {
    throw new AppError('Maintenance period not found.', 404, 'NOT_FOUND');
  }
  res.json({ success: true, message: 'Maintenance period cancelled.', data: period });
}
