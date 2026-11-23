import { describeReloadDataContract } from '../contract/reload-data.contract';
import { provideDataServices } from '../data-providers';

describeReloadDataContract('InMemoryReloadDataService float', () => [provideDataServices(true)]);
