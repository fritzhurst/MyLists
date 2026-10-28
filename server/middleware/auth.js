import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const FORBIDDEN_SECRETS = new Set([
  'mylists-secret-change-in-production',
  'mylists-production-secret',
]);

if (!JWT_SECRET || JWT_SECRET.length < 32 || FORBIDDEN_SECRETS.has(JWT_SECRET)) {
  console.error(
    '\nFATAL: JWT_SECRET must be set to a strong random value (>=32 chars).\n' +
    'Generate one with: openssl rand -hex 64\n' +
    'Then add it to your .env as: JWT_SECRET=<value>\n'
  );
  process.exit(1);
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
