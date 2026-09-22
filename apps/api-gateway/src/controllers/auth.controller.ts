import { Controller, Post, Body, Get, Query, Inject, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { GRPC_SERVICES } from '@tkt/proto';

interface IAuthService {
  register(data: any): Observable<any>;
  login(data: any): Observable<any>;
  validateToken(data: any): Observable<any>;
  getUserProfile(data: any): Observable<any>;
}

@Controller('auth')
export class AuthHttpController implements OnModuleInit {
  private authService!: IAuthService;

  constructor(@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.authService = this.client.getService<IAuthService>(GRPC_SERVICES.AUTH_SERVICE);
  }

  @Post('register')
  async register(@Body() body: { email: string; password: string; name: string; role?: string }) {
    const res = await firstValueFrom(this.authService.register(body));
    if (!res.success) {
      throw new HttpException(res.error_message || 'Registration failed', HttpStatus.BAD_REQUEST);
    }
    return res;
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const res = await firstValueFrom(this.authService.login(body));
    if (!res.success) {
      throw new HttpException(res.error_message || 'Login failed', HttpStatus.UNAUTHORIZED);
    }
    return res;
  }

  @Get('profile')
  async getProfile(@Query('userId') userId: string) {
    return firstValueFrom(this.authService.getUserProfile({ user_id: userId }));
  }
}
