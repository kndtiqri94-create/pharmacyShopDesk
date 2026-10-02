import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types';

// Database
import { DatabaseService } from './database/database.service';

// Repositories
import { ISystemUserRepository } from '../interfaces/repositories/system-user.repository.interface';
import { SystemUserRepository } from '../infrastructure/repositories/system-user.repository.impl';


// Services
import { ISystemUserService } from '../interfaces/services/system-user.service.interface';
import { SystemUserService } from './business/system-user.service.impl';

const container = new Container();

// Database
container.bind<DatabaseService>(TYPES.DatabaseService).to(DatabaseService).inSingletonScope();

// Repositories
container.bind<ISystemUserRepository>(TYPES.SystemUserRepository).to(SystemUserRepository);

// Services
container.bind<ISystemUserService>(TYPES.SystemUserService).to(SystemUserService);

export { container };
