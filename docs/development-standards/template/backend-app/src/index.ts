import { app } from '@azure/functions';

// Import all function files to register them
import './functions/users/get-users';
import './functions/users/search-users';
import './functions/users/get-user';
import './functions/users/get-my-user-profile';
import './functions/users/create-user';
import './functions/users/update-user';
import './functions/users/delete-user';

app.setup({
    enableHttpStream: true,
});
