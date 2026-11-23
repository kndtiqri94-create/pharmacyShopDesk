import { freshLocalProviders } from '../../../../../testing/local-data-test.util';
import { describeCollectionsDataContract } from '../contract/collections-data.contract';
import { describeProductDataContract } from '../contract/product-data.contract';
import { describeReloadDataContract } from '../contract/reload-data.contract';
import { describeRoleDataContract } from '../contract/role-data.contract';
import { describeSalesDataExtrasContract } from '../contract/sales-data-extras.contract';
import { describeSalesDataContract } from '../contract/sales-data.contract';
import { describeSeedCoverageContract } from '../contract/seed-coverage.contract';
import { describeUserAndSyncDataContract } from '../contract/user-and-sync-data.contract';

describeProductDataContract('LocalProductDataService', freshLocalProviders);
describeSalesDataContract('LocalSalesDataService', freshLocalProviders);
describeSalesDataExtrasContract('LocalSalesDataService extras', freshLocalProviders);
describeRoleDataContract('LocalRoleDataService', freshLocalProviders);
describeReloadDataContract('LocalReloadDataService float', freshLocalProviders);
describeUserAndSyncDataContract(
  'LocalUserDataService and LocalSyncDataService',
  freshLocalProviders
);
describeSeedCoverageContract('local seed coverage', freshLocalProviders);
describeCollectionsDataContract('Local collection services', freshLocalProviders);
