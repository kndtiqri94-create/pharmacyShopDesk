import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { container } from '../../services/container';
import { TYPES } from '../../services/types';
import { ISystemUserService } from '../../interfaces/services/system-user.service.interface';
import { UpdateUserDto } from '../../models/dtos/user/update-user.dto';
import { validate } from 'class-validator';
import { HttpResponseHelper } from '../../helpers/http-response.helper';

app.http('updateUser', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'users/updateUser',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');

      if (!id) {
        return HttpResponseHelper.badRequest('User ID is required');
      }

      const userId = parseInt(id);
      if (isNaN(userId)) {
        return HttpResponseHelper.badRequest('Invalid user ID');
      }

      const body = await request.json();
      
      // Create and validate the user data
      const userData = Object.assign(new UpdateUserDto(), body);
      const errors = await validate(userData, { skipMissingProperties: true });

      if (errors.length > 0) {
        const errorMessages = errors.map(error => Object.values(error.constraints || {})).flat();
        return HttpResponseHelper.validationError('Validation failed', errorMessages);
      }

      // TODO: Extract current user from JWT token
      const currentUser = 'system'; // Placeholder for now

      context.log(`Updating user with ID: ${userId}`);

      const userService = container.get<ISystemUserService>(TYPES.SystemUserService);
      const user = await userService.updateSystemUser(userId, userData, currentUser);

      if (!user) {
        return HttpResponseHelper.notFound('User not found');
      }

      return HttpResponseHelper.success(user, 'User updated successfully');
    } catch (error) {
      context.error('Error updating user:', error);
      
      if (error instanceof Error) {
        return HttpResponseHelper.badRequest(error.message);
      }

      return HttpResponseHelper.internalServerError('Failed to update user');
    }
  },
});
