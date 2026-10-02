import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { container } from '../../services/container';
import { TYPES } from '../../services/types';
import { ISystemUserService } from '../../interfaces/services/system-user.service.interface';
import { HttpResponseHelper } from '../../helpers/http-response.helper';

app.http('getUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/getUser',
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

      context.log(`Getting user with ID: ${userId}`);

      const userService = container.get<ISystemUserService>(TYPES.SystemUserService);
      const user = await userService.getSystemUserById(userId);

      if (!user) {
        return HttpResponseHelper.notFound('User not found');
      }

      return HttpResponseHelper.success(user, 'User retrieved successfully');
    } catch (error) {
      context.error('Error getting user:', error);
      return HttpResponseHelper.internalServerError('Failed to retrieve user');
    }
  },
});
