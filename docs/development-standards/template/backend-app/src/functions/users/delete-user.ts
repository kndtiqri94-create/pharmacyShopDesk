import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { container } from '../../services/container';
import { TYPES } from '../../services/types';
import { HttpResponseHelper } from '../../helpers/http-response.helper';
import { ISystemUserService } from '../../interfaces/services/system-user.service.interface';

app.http('deleteUser', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'users/deleteUser',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');

      if (!id) {
        return HttpResponseHelper.missingParameter('User ID');
      }

      const userId = parseInt(id);
      if (isNaN(userId)) {
        return HttpResponseHelper.invalidParameter('User ID', 'number');
      }

      // TODO: Extract current user from JWT token
      const currentUser = 'system'; // Placeholder for now

      context.log(`Deleting user with ID: ${userId}`);

      const userService = container.get<ISystemUserService>(TYPES.SystemUserService);
      const success = await userService.deleteSystemUser(userId, currentUser);

      if (!success) {
        return HttpResponseHelper.notFoundOrCannotDelete('User');
      }

      return HttpResponseHelper.success(null, 'User deleted successfully');
    } catch (error) {
      context.error('Error deleting user:', error);
      
      if (error instanceof Error) {
        return HttpResponseHelper.badRequest(error.message);
      }

      return HttpResponseHelper.internalServerError('Failed to delete user');
    }
  },
});
