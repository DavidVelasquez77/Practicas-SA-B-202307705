import {
  Module,
} from '@nestjs/common';

import {
  ComicsResolver,
} from './comics.resolver';

import {
  ComicsService,
} from './comics.service';

@Module({
  providers: [
    ComicsResolver,
    ComicsService,
  ],
})
export class ComicsModule {}