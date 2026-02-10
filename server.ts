
/**
 * CLEVERKIDS BACKEND SERVER
 * Technology Stack: Node.js, Express, JWT, Bcrypt
 */

/* 
// Example Installation:
// npm install express jsonwebtoken bcryptjs dotenv cors
*/

/*
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// --- DATABASE SCHEMA (Conceptual) ---
// id: string (UUID)
// email: string (Unique)
// passwordHash: string
// role: 'STUDENT' | 'ADMIN'
// modeAccess: 'native' | 'classic'
// isActive: boolean
// createdAt: Date

// --- MIDDLEWARE ---

const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Not authorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains id and role
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token failed' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

// --- ROUTES ---

// AUTH: Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  // Save to DB...
  // Default: role='STUDENT', modeAccess='classic', isActive=true
  res.status(201).json({ message: 'User created' });
});

// AUTH: Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  // Find user in DB...
  // const isMatch = await bcrypt.compare(password, user.passwordHash);
  // Generate Token...
  // const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
});

// ADMIN: Get all students
app.get('/api/admin/users', protect, adminOnly, async (req, res) => {
  // Return all users (exclude passwordHash)
});

// ADMIN: Update Mode Access
app.patch('/api/admin/users/:id/mode', protect, adminOnly, async (req, res) => {
  const { modeAccess } = req.body;
  // Update user in DB...
});

// ADMIN: Toggle Status
app.patch('/api/admin/users/:id/status', protect, adminOnly, async (req, res) => {
  const { isActive } = req.body;
  // Update user in DB...
});

// ADMIN: Delete User
app.delete('/api/admin/users/:id', protect, adminOnly, async (req, res) => {
  // Delete from DB...
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
*/
