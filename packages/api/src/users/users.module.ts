import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersService } from './users.service';
import { UserSessionService } from './user-session.service';
import { SessionGuard } from './session.guard';
import { UsersController } from './users.controller';
import { DashboardApiKeysController } from './dashboard-api-keys.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Global()
@Module({
  imports: [ConfigModule, WorkspacesModule],
  providers: [UsersService, UserSessionService, SessionGuard],
  controllers: [UsersController, DashboardApiKeysController],
  exports: [UsersService, UserSessionService, SessionGuard],
})
export class UsersModule {}
