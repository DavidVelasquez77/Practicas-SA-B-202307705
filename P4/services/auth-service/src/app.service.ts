import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus(): {
    message: string;
    status: string;
  } {
    return {
      message: 'API de autenticación y autorización',
      status: 'ok',
    };
  }
}