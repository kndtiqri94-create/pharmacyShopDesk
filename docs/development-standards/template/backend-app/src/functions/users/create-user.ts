import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { container } from '../../services/container';
import { TYPES } from '../../services/types';
import { ISystemUserService } from '../../interfaces/services/system-user.service.interface';
import { HttpResponseHelper } from '../../helpers/http-response.helper';
import { CreateUserDto } from '../../models/dtos/user/create-user.dto';
import { validate } from 'class-validator';

app.http('createUser', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'users/createUser',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = await request.json();
      
      // Create and validate the user data
      const userData = Object.assign(new CreateUserDto(), body);
      const errors = await validate(userData);
      
      if (errors.length > 0) {
        const errorMessages = errors.map(error => Object.values(error.constraints || {})).flat();
        return HttpResponseHelper.validationError('Validation failed', errorMessages);
      }

      // TODO: Extract current user from JWT token
      const currentUser = 'system'; // Placeholder for now

      context.log('Creating new user:', userData.email);

      const userService = container.get<ISystemUserService>(TYPES.SystemUserService);
      const user = await userService.createSystemUser(userData, currentUser);

      return HttpResponseHelper.created(user, 'User created successfully');
    } catch (error) {
      context.error('Error creating user:', error);
      
      if (error instanceof Error) {
        return HttpResponseHelper.badRequest(error.message);
      }

      return HttpResponseHelper.internalServerError('Failed to create user');
    }
  },
});
