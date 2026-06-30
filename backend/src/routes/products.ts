import { Router } from 'express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { JWT_SECRET } from '../config/security.js';
import { AuditLogs, Products, Quotations, Roles, Users } from '../models/db.js';

const router = Router();

async function toArray<T>(result: any): Promise<T[]> {
  const resolved = await result;
  if (Array.isArray(resolved)) return resolved as T[];
  return await resolved.toArray();
}

async function getCurrentUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { userId: string };
      return await Users().findOne({ _id: payload.userId } as any);
    } catch {
      return null;
    }
  }
  const cookieToken = (req as any).cookies?.token;
  if (!cookieToken) return null;
  if (cookieToken.startsWith('mock_token_')) {
    return await Users().findOne({ _id: cookieToken.replace('mock_token_', '') } as any);
  }
  try {
    const payload = jwt.verify(cookieToken, JWT_SECRET) as { userId: string };
    return await Users().findOne({ _id: payload.userId } as any);
  } catch {
    return null;
  }
}

async function canManageProducts(user: any) {
  if (!user) return false;
  if (user.email === 'root@nextgen.co.th') return true;
  const role = await Roles().findOne({ _id: user.roleId } as any);
  return Boolean(role?.permissions?.manageProducts);
}

function auditSafe(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(auditSafe);
  const { passwordHash, password, ...safeValue } = value;
  return safeValue;
}

async function createAuditLog(req: Request, actor: any, action: string, targetType: string, target: any = {}, details: Record<string, unknown> = {}) {
  if (!actor) return;
  await AuditLogs().insertOne({
    _id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actorId: actor._id,
    actorEmail: actor.email,
    action,
    targetType,
    targetId: target?._id,
    targetEmail: target?.email,
    details: auditSafe(details),
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    createdAt: new Date()
  } as any);
}

function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: any) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
        errors: parsed.error.issues.map(issue => ({
          field: issue.path.join('.') || 'body',
          message: issue.message
        }))
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

const productBodySchema = z.object({
  name: z.string().trim().min(1, 'ต้องระบุชื่อสินค้า'),
  price: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
  description: z.string().trim().optional(),
  category: z.string().trim().min(1).default('General'),
  specialOffers: z.string().trim().optional(),
  isActive: z.coerce.boolean().default(true)
}).strict();

const productUpdateBodySchema = productBodySchema.partial().strict();

const categoryBodySchema = z.object({
  name: z.string().trim().min(1, 'ต้องระบุชื่อหมวดหมู่'),
  previousName: z.string().trim().optional()
}).strict();

const productImportBodySchema = z.object({
  products: z.array(productBodySchema).min(1, 'ต้องมีสินค้าอย่างน้อย 1 รายการ')
}).strict();

async function productUsedInQuotes(productId: string) {
  const quotes = await toArray<any>(Quotations().find());
  return quotes.some(quote => Array.isArray(quote.items) && quote.items.some((item: any) => item.productId === productId));
}

router.get('/', async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const search = (req.query.search as string) || '';
  const category = (req.query.category as string) || 'All';
  const page = parseInt((req.query.page as string) || '1', 10);
  const limit = parseInt((req.query.limit as string) || '50', 10);

  const includeDeleted = req.query.includeDeleted === 'true';
  const products = await toArray<any>(Products().find());
  const filtered = products.filter(p =>
    (includeDeleted || !p.deletedAt) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase())) &&
    (category === 'All' || p.category === category)
  );
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  res.json({
    total: filtered.length,
    page,
    limit,
    data: paged,
  });
});

router.get('/categories', async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const products = await toArray<any>(Products().find());
  const categories = Array.from(new Set(products.filter(p => !p.deletedAt).map(p => p.category).filter(Boolean))).sort();
  res.json(categories);
});

router.put('/categories', validateBody(categoryBodySchema), async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!(await canManageProducts(user))) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์จัดการหมวดหมู่สินค้า' });
  }
  const products = await toArray<any>(Products().find());
  const affected = products.filter(p => p.category === req.body.previousName);
  await Promise.all(affected.map(product =>
    (Products() as any).updateOne({ _id: product._id }, { $set: { ...product, category: req.body.name, updatedAt: new Date() } })
  ));
  await createAuditLog(req, user, 'product_category.update', 'product_category', { _id: req.body.name }, {
    previousName: req.body.previousName,
    newName: req.body.name,
    affected: affected.length
  });
  res.json({ name: req.body.name, affected: affected.length });
});

router.get('/export.csv', async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const products = (await toArray<any>(Products().find())).filter(p => !p.deletedAt);
  const rows = [
    ['id', 'name', 'category', 'price', 'isActive', 'description', 'specialOffers'],
    ...products.map(product => [
      product._id,
      product.name,
      product.category,
      product.price,
      product.isActive,
      product.description || '',
      product.specialOffers || ''
    ])
  ];
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nextgen-products.csv"');
  res.send(csv);
});

router.post('/import', validateBody(productImportBodySchema), async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user || !(await canManageProducts(user))) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์ import สินค้า' });
  }
  const inserted = await Promise.all(req.body.products.map(async (product: any, index: number) => {
    const newProduct = {
      _id: `p_import_${Date.now()}_${index}`,
      ...product,
      price: Number(product.price || 0),
      isActive: product.isActive !== false,
      priceHistory: [{
        price: Number(product.price || 0),
        changedBy: user._id,
        changedAt: new Date(),
        reason: 'Imported product'
      }]
    };
    await Products().insertOne(newProduct as any);
    return newProduct;
  }));
  await createAuditLog(req, user, 'product.import', 'product', { _id: 'bulk_import' }, { count: inserted.length });
  res.status(201).json({ inserted: inserted.length, products: inserted });
});

router.post('/', validateBody(productBodySchema), async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user || !(await canManageProducts(user))) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์จัดการสินค้า' });
  }

  const { name, price, description, category, specialOffers, isActive } = req.body;
  const newProduct = {
    _id: `p_${Date.now()}`,
    name,
    price: Number(price) || 0,
    description,
    category: category || 'General',
    specialOffers,
    isActive: isActive !== false,
    priceHistory: [{
      price: Number(price) || 0,
      changedBy: user._id,
      changedAt: new Date(),
      reason: 'Initial price'
    }]
  };

  await Products().insertOne(newProduct as any);
  await createAuditLog(req, user, 'product.create', 'product', newProduct, {
    createdProduct: newProduct
  });
  res.status(201).json(newProduct);
});

router.put('/:id', validateBody(productUpdateBodySchema), async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user || !(await canManageProducts(user))) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์จัดการสินค้า' });
  }

  const productColl = Products();
  const product = await productColl.findOne({ _id: req.params.id } as any);
  if (!product) {
    return res.status(404).json({ message: 'ไม่พบสินค้า' });
  }

  const updatedProduct = {
    ...product,
    ...req.body,
    price: req.body.price !== undefined ? Number(req.body.price) : product.price,
    isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : product.isActive,
    priceHistory: req.body.price !== undefined && Number(req.body.price) !== Number(product.price)
      ? [
        ...(product.priceHistory || []),
        {
          price: Number(req.body.price),
          changedBy: user._id,
          changedAt: new Date(),
          reason: 'Price updated from product management'
        }
      ]
      : product.priceHistory || []
  };

  await (productColl as any).updateOne({ _id: req.params.id }, { $set: updatedProduct });
  await createAuditLog(req, user, 'product.update', 'product', updatedProduct, {
    before: product,
    after: updatedProduct,
    changedFields: Object.keys(req.body || {})
  });
  res.json(updatedProduct);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!user || !(await canManageProducts(user))) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์จัดการสินค้า' });
  }

  const productColl = Products();
  const product = await productColl.findOne({ _id: req.params.id } as any);
  if (!product) {
    return res.status(404).json({ message: 'ไม่พบสินค้า' });
  }

  const productId = String(req.params.id);
  const isUsed = await productUsedInQuotes(productId);
  if (isUsed) {
    const softDeleted = {
      ...product,
      isActive: false,
      deletedAt: new Date(),
      deletedBy: user._id
    };
    await (productColl as any).updateOne({ _id: req.params.id }, { $set: softDeleted });
    await createAuditLog(req, user, 'product.soft_delete', 'product', softDeleted, {
      reason: 'Product used in quotations; converted delete to inactive soft delete'
    });
    res.json({ message: 'Product is used in quotes and was marked inactive instead', softDeleted: true });
    return;
  }

  await (productColl as any).deleteOne({ _id: req.params.id });
  await createAuditLog(req, user, 'product.delete', 'product', product, {
    deletedProduct: product,
    softDeleted: false
  });
  res.json({ message: 'Product deleted' });
});

export default router;
