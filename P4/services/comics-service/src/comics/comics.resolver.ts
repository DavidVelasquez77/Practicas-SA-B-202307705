import {
  Args,
  Int,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';

import {
  CreateComicInput,
} from './dto/create-comic.input';

import {
  Comic,
} from './models/comic.model';

import {
  ComicsService,
} from './comics.service';

@Resolver(() => Comic)
export class ComicsResolver {
  constructor(
    private readonly comicsService:
      ComicsService,
  ) {}

  @Query(() => [Comic], {
    name: 'comics',
  })
  async findAll(): Promise<Comic[]> {
    return this.comicsService.findAll();
  }

  @Query(() => Comic, {
    name: 'comic',
    nullable: true,
  })
  async findOne(
    @Args(
      'id',
      {
        type: () => Int,
      },
    )
    id: number,
  ): Promise<Comic | null> {
    return this.comicsService.findOne(
      id,
    );
  }

  @Mutation(() => Comic)
  async createComic(
    @Args('input')
    input: CreateComicInput,
  ): Promise<Comic> {
    return this.comicsService.create(
      input,
    );
  }
}