export interface Customer {
  id: string;
  workspaceId: string;
  externalId?: string;
  email: string;
  name?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
