import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { User } from './entities/user.entity';

const JWT_SECRET = process.env.JWT_SECRET || 'tkt-super-secret-key-2026';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) {}

  async onModuleInit() {
    this.logger.log('AuthService initialized. Authentication relies strictly on real registered users in PostgreSQL.');
  }

  async register(data: { email: string; password: string; name: string; role?: string }) {
    const existing = await this.userRepo.findOneBy({ email: data.email });
    if (existing) {
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
    const newUser = await this.userRepo.save({
      id,
      email: data.email,
      passwordHash,
      name: data.name,
      role,
    });

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
    const user = await this.userRepo.findOneBy({ email: data.email });
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

  async getUserProfile(userId: string) {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      return {
        id: '',
        email: '',
        name: '',
        role: '',
        created_at: '',
      };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.createdAt.toISOString(),
    };
  }
}
