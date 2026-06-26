import { Router } from 'express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Products, Users } from '../models/db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

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

function canManageProducts(user: any) {
  return user && user.rank >= 4;
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

  const products = await toArray<any>(Products().find());
  const filtered = products.filter(p =>
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

router.post('/', async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!canManageProducts(user)) {
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
    isActive: isActive !== false
  };

  await Products().insertOne(newProduct as any);
  res.status(201).json(newProduct);
});

router.put('/:id', async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!canManageProducts(user)) {
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
    isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : product.isActive
  };

  await (productColl as any).updateOne({ _id: req.params.id }, { $set: updatedProduct });
  res.json(updatedProduct);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const user = await getCurrentUser(req);
  if (!canManageProducts(user)) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์จัดการสินค้า' });
  }

  const productColl = Products();
  const product = await productColl.findOne({ _id: req.params.id } as any);
  if (!product) {
    return res.status(404).json({ message: 'ไม่พบสินค้า' });
  }

  await (productColl as any).deleteOne({ _id: req.params.id });
  res.json({ message: 'Product deleted' });
});

export default router;
