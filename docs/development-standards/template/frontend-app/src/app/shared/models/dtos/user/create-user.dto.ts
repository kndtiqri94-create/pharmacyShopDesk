export interface CreateUserDto {
  email: string;
  name: string;
  isActive?: boolean;
  organizationId: number;
}
