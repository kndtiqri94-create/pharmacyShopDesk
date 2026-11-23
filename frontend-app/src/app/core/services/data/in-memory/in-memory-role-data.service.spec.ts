import { describeRoleDataContract } from '../contract/role-data.contract';
import { provideDataServices } from '../data-providers';

describeRoleDataContract('InMemoryRoleDataService', () => [provideDataServices(true)]);
