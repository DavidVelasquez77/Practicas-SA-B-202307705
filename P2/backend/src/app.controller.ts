import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStatus(): {
    message: string;
    status: string;
  } {
    return this.appService.getStatus();
  }
}