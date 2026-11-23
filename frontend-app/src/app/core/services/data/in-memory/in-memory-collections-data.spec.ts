import { describeCollectionsDataContract } from '../contract/collections-data.contract';
import { provideDataServices } from '../data-providers';

describeCollectionsDataContract('InMemory collection services', () => [provideDataServices(true)]);
