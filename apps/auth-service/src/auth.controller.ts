import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { GRPC_SERVICES } from '@tkt/proto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod(GRPC_SERVICES.AUTH_SERVICE, 'Register')
  async register(data: { email: string; password: string; name: string; role?: string }) {
    return this.authService.register(data);
  }

  @GrpcMethod(GRPC_SERVICES.AUTH_SERVICE, 'Login')
  async login(data: { email: string; password: string }) {
    return this.authService.login(data);
  }

  @GrpcMethod(GRPC_SERVICES.AUTH_SERVICE, 'ValidateToken')
  validateToken(data: { token: string }) {
    return this.authService.validateToken(data.token);
  }

  @GrpcMethod(GRPC_SERVICES.AUTH_SERVICE, 'GetUserProfile')
  async getUserProfile(data: any) {
    const userId = data.userId || data.user_id;
    return this.authService.getUserProfile(userId);
  }
}
