import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  RefreshTokenDto,
  GoogleLoginDto,
  AdminLoginDto,
} from './dto';
import { JwtAuthGuard } from './guards';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP',
    description:
      'Send a 6-digit OTP to the provided phone number via Twilio Verify SMS. Rate limiting is handled by Twilio.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      example: {
        success: true,
        message: 'OTP sent successfully',
        data: {
          expiresIn: 300,
          isNewUser: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phone number format',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many OTP requests',
  })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP & Login',
    description:
      'Verify the OTP code and receive JWT tokens. If the user does not exist, a new account is automatically created. Optionally include a referral code for first-time registration and FCM token for push notifications.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful — tokens and user data returned',
    schema: {
      example: {
        success: true,
        message: 'Authentication successful',
        data: {
          accessToken: 'eyJhbGciOi...',
          refreshToken: 'eyJhbGciOi...',
          expiresIn: 86400,
          user: {
            id: 'uuid',
            phone: '+250788123456',
            firstName: null,
            lastName: null,
            email: null,
            userType: 'RESIDENTIAL',
            role: 'USER',
            referralCode: 'ECOXYZ12',
            avatarUrl: null,
            ecoPoints: 100,
            ecoTier: 'ECO_STARTER',
            isNewUser: true,
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Use a valid refresh token to obtain a new access token without re-authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'New access token issued',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOi...',
          expiresIn: 86400,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout',
    description:
      'Revoke all refresh tokens for the current user, effectively logging them out from all devices.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    schema: {
      example: {
        success: true,
        message: 'Logged out successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with Google',
    description:
      'Verify the Firebase ID Token and receive JWT tokens. If the user does not exist, a new account is automatically created.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
  })
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin Login (Email/Password)',
    description:
      'Login as admin using hardcoded email and password. No OTP required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin login successful',
  })
  @ApiResponse({ status: 401, description: 'Invalid admin credentials' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }
}
