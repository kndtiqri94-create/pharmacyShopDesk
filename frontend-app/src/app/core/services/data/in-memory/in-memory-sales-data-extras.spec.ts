import { describeSalesDataExtrasContract } from '../contract/sales-data-extras.contract';
import { provideDataServices } from '../data-providers';

describeSalesDataExtrasContract('InMemorySalesDataService extras', () => [
  provideDataServices(true),
]);
