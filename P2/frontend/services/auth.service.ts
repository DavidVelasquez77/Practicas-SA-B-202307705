import { API_BASE_URL } from '@/constants/api.constants';
import { apiRequest } from '@/services/http-client';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '@/types/auth.types';

export const authService = {
  login(data: LoginRequest): Promise<LoginResponse> {
    return apiRequest<LoginResponse>(
      `${API_BASE_URL}/auth/login`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  register(
    data: RegisterRequest,
  ): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>(
      `${API_BASE_URL}/auth/register`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },
};