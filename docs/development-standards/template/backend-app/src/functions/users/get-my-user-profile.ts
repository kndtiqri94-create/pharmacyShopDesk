import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { container } from '../../services/container';
import { TYPES } from '../../services/types';
import { ISystemUserService } from '../../interfaces/services/system-user.service.interface';
import { HttpResponseHelper } from '../../helpers/http-response.helper';

app.http('getMyUserProfile', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'systemuser/getMyUserProfile',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      
    console.log('request', request);
      const currentUserEmail = 'hdi@tiqri.com';
      
      context.log(`Getting profile for current user: ${currentUserEmail}`);

      const userService = container.get<ISystemUserService>(TYPES.SystemUserService);
      const user = await userService.getSystemUserByEmail(currentUserEmail);

      if (!user) {
        return HttpResponseHelper.notFound('User profile not found');
      }

      return HttpResponseHelper.success(user, 'User profile retrieved successfully');
    } catch (error) {
      context.error('Error getting user profile:', error);
      return HttpResponseHelper.internalServerError('Failed to retrieve user profile');
    }
  },
});
