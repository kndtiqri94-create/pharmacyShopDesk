import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { container } from '../../services/container';
import { TYPES } from '../../services/types';
import { ISystemUserService } from '../../interfaces/services/system-user.service.interface';
import { HttpResponseHelper } from '../../helpers/http-response.helper';
import { SearchUsersDto } from '../../models/dtos/user/search-users.dto';

app.http('searchUsers', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'users/searchUsers',
    handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        try {
            context.log('Searching users');
            const body = await request.json();
            const searchDto = Object.assign(new SearchUsersDto(), body);
            searchDto.normalizePagination();

            const userService = container.get<ISystemUserService>(TYPES.SystemUserService);
            const result = await userService.searchSystemUsers(searchDto);

            return HttpResponseHelper.success(result, 'Users searched successfully');
        } catch (error) {
            context.error('Error searching users:', error);
            return HttpResponseHelper.internalServerError('Failed to search users');
        }
    },
});
