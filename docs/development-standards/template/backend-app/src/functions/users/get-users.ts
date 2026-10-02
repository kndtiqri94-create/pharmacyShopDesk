import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { container } from '../../services/container';
import { TYPES } from '../../services/types';
import { ISystemUserService } from '../../interfaces/services/system-user.service.interface';
import { HttpResponseHelper } from '../../helpers/http-response.helper';

app.http('getUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/getUsers',
  handler: async (_request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      context.log('Getting all users');

      const userService = container.get<ISystemUserService>(TYPES.SystemUserService);
      const users = await userService.getAllSystemUsers();

      return HttpResponseHelper.success(users, 'Users retrieved successfully');
    } catch (error) {
      context.error('Error getting users:', error);
      return HttpResponseHelper.internalServerError('Failed to retrieve users');
    }
  },
});
