import {Module} from '@nestjs/common';
import {CacheModule} from '@nestjs/cache-manager';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {CqrsModule} from '@nestjs/cqrs';
import {TypeOrmModule} from '@nestjs/typeorm';
import {RedisClientOptions} from 'redis';
import {AutomapperModule} from '@automapper/nestjs';
import {classes} from '@automapper/classes';
import {redisStore} from 'cache-manager-redis-yet';
import {Transaction} from './transaction/transaction.entity';
import {CreateTransactionCommandHandler} from './operations/commands/create/create.transaction.handler';
import {ClientsModule, Transport} from '@nestjs/microservices';
import {UpdateTransactionCommandHandler} from './operations/commands/update/update.transaction.handler';
import {GetTransactionQueryHandler} from './operations/queries/get/get.transaction.handler';
import {TransactionService} from './transaction/transaction.service';
import {TransactionController} from './transaction/transaction.controller';
import {TransactionProfile} from './transaction/transaction.profile';

@Module({
  imports: [
    CqrsModule,
    ConfigModule.forRoot({
      envFilePath: [`.env`],
    }),
    CacheModule.registerAsync<RedisClientOptions>({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const store = await redisStore({
          password: configService.get('REDIS_PASSWORD'),
          socket: {
            host: configService.get('REDIS_HOST'),
            port: configService.get('REDIS_PORT'),
          },
        });
        return {
          store: {
            create: () => store,
          },
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    TypeOrmModule.forFeature([Transaction]),
    AutomapperModule.forRoot({
      strategyInitializer: classes(),
    }),
    ClientsModule.register([
      {
        name: 'TRANSACTION_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: ['localhost:9092'],
          },
          consumer: {
            groupId: 'transaction-consumer',
          },
        },
      },
    ]),
  ],
  controllers: [TransactionController],
  providers: [
    TransactionProfile,
    TransactionService,
    CreateTransactionCommandHandler,
    UpdateTransactionCommandHandler,
    GetTransactionQueryHandler,
  ],
})
export class AppModule {}
