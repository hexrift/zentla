import { SetMetadata } from '@nestjs/common';

export type ApiKeyRole = 'owner' | 'admin' | 'member' | 'readonly';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: ApiKeyRole[]) => SetMetadata(ROLES_KEY, roles);

// Convenience decorators
export const OwnerOnly = () => Roles('owner');
export const AdminOnly = () => Roles('owner', 'admin');
export const MemberOnly = () => Roles('owner', 'admin', 'member');
export const ReadonlyAllowed = () => Roles('owner', 'admin', 'member', 'readonly');
