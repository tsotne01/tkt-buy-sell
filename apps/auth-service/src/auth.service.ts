import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tkt-super-secret-key-2026';

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  createdAt: string;
}

@Injectable()
export class AuthService {
  // In-memory persistent state for fast dev, easily connected to Postgres
  private users: Map<string, UserEntity> = new Map();

  constructor() {
    // Seed initial demo users
    const demoPasswordHash = bcrypt.hashSync('password123', 10);
    const demoBuyer: UserEntity = {
      id: 'usr_buyer_1',
      email: 'buyer@example.com',
      passwordHash: demoPasswordHash,
      name: 'Alice Buyer',
      role: 'BUYER',
      createdAt: new Date().toISOString(),
    };
    const demoSeller: UserEntity = {
      id: 'usr_seller_1',
      email: 'seller@example.com',
      passwordHash: demoPasswordHash,
      name: 'Bob Seller',
      role: 'SELLER',
      createdAt: new Date().toISOString(),
    };
    this.users.set(demoBuyer.email, demoBuyer);
    this.users.set(demoSeller.email, demoSeller);
  }

  async register(data: { email: string; password: string; name: string; role?: string }) {
    if (this.users.has(data.email)) {
      return {
        success: false,
        error_message: 'User with this email already exists',
        token: '',
        user_id: '',
        email: '',
        name: '',
        role: '',
      };
    }

    const id = `usr_${Date.now()}`;
    const passwordHash = await bcrypt.hash(data.password, 10);
    const role = data.role || 'BUYER';
    const newUser: UserEntity = {
      id,
      email: data.email,
      passwordHash,
      name: data.name,
      role,
      createdAt: new Date().toISOString(),
    };

    this.users.set(data.email, newUser);

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      success: true,
      token,
      user_id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      error_message: '',
    };
  }

  async login(data: { email: string; password: string }) {
    const user = this.users.get(data.email);
    if (!user) {
      return {
        success: false,
        error_message: 'Invalid email or password',
        token: '',
        user_id: '',
        email: '',
        name: '',
        role: '',
      };
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      return {
        success: false,
        error_message: 'Invalid email or password',
        token: '',
        user_id: '',
        email: '',
        name: '',
        role: '',
      };
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      success: true,
      token,
      user_id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      error_message: '',
    };
  }

  validateToken(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
        role: string;
      };
      return {
        valid: true,
        user_id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch {
      return {
        valid: false,
        user_id: '',
        email: '',
        role: '',
      };
    }
  }

  getUserProfile(userId: string) {
    for (const user of this.users.values()) {
      if (user.id === userId) {
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          created_at: user.createdAt,
        };
      }
    }
    return {
      id: '',
      email: '',
      name: '',
      role: '',
      created_at: '',
    };
  }
}
