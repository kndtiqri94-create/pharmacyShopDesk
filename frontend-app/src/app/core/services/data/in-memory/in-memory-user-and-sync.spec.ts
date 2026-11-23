import { describeUserAndSyncDataContract } from '../contract/user-and-sync-data.contract';
import { provideDataServices } from '../data-providers';

describeUserAndSyncDataContract('InMemoryUserDataService and InMemorySyncDataService', () => [
  provideDataServices(true),
]);
