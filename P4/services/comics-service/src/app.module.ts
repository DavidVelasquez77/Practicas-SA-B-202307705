import {
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
} from '@nestjs/config';

import {
  ApolloDriver,
  ApolloDriverConfig,
} from '@nestjs/apollo';

import {
  GraphQLModule,
} from '@nestjs/graphql';

import {
  PrismaModule,
} from './prisma/prisma.module';

import {
  ComicsModule,
} from './comics/comics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      graphiql: true,
    }),

    PrismaModule,
    ComicsModule,
  ],
})
export class AppModule {}