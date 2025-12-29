import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { RolesGuard } from './guards/roles.guard';
import { WorkspaceGuard } from './guards/workspace.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ApiKeyService, ApiKeyGuard, RolesGuard, WorkspaceGuard],
  exports: [ApiKeyService, ApiKeyGuard, RolesGuard, WorkspaceGuard],
})
export class AuthModule {}
