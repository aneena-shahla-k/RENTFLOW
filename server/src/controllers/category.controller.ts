import { Response } from 'express';
import { Category } from '../models/Category.js';
import { AuthRequest } from '../types/index.js';
import { AppError } from '../utils/errors.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function listCategories(req: AuthRequest, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (req.companyId) {
    filter.companyId = req.companyId;
  } else if (req.query.companyId) {
    filter.companyId = req.query.companyId;
    filter.active = true;
  } else {
    filter.active = true;
  }

  const categories = await Category.find(filter).sort({ name: 1 });
  res.json({ success: true, data: categories });
}

export async function createCategory(req: AuthRequest, res: Response): Promise<void> {
  const slug = slugify(req.body.name);
  const existing = await Category.findOne({ companyId: req.companyId, slug });
  if (existing) {
    throw new AppError('A category with this name already exists in your company.', 409, 'CATEGORY_EXISTS');
  }

  const category = await Category.create({
    ...req.body,
    slug,
    companyId: req.companyId,
    parentId: req.body.parentId || null,
  });

  res.status(201).json({
    success: true,
    message: 'Category created.',
    data: category,
  });
}

export async function updateCategory(req: AuthRequest, res: Response): Promise<void> {
  const category = await Category.findOne({
    _id: req.params.id,
    companyId: req.companyId,
  });
  if (!category) {
    throw new AppError('Category not found.', 404, 'NOT_FOUND');
  }

  if (req.body.name) {
    category.name = req.body.name;
    category.slug = slugify(req.body.name);
  }
  if (req.body.description !== undefined) category.description = req.body.description;
  if (req.body.parentId !== undefined) category.parentId = req.body.parentId || null;
  if (req.body.icon !== undefined) category.icon = req.body.icon;
  if (req.body.active !== undefined) category.active = req.body.active;

  await category.save();

  res.json({
    success: true,
    message: 'Category updated.',
    data: category,
  });
}

export async function deleteCategory(req: AuthRequest, res: Response): Promise<void> {
  const category = await Category.findOneAndDelete({
    _id: req.params.id,
    companyId: req.companyId,
  });
  if (!category) {
    throw new AppError('Category not found.', 404, 'NOT_FOUND');
  }
  res.json({ success: true, message: 'Category deleted.' });
}
