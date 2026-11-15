import { TestBed } from '@angular/core/testing';
import { BankAccountDataService } from './bank-account-data.service';
import { InMemoryBankAccountDataService } from './in-memory/in-memory-bank-account-data.service';
import { InMemoryProductDataService } from './in-memory/in-memory-product-data.service';
import { provideDataServices } from './data-providers';
import { InMemoryProductSyncServer } from './in-memory/in-memory-product-sync-server';
import { ProductDataService } from './product-data.service';
import { ProductSyncServer } from './product-sync-server';

describe('provideDataServices', () => {
  it('binds the in-memory implementations when mock data is on', () => {
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect(TestBed.inject(ProductDataService)).toBeInstanceOf(InMemoryProductDataService);
  });

  it('binds the bank account data service to its in-memory implementation', () => {
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect(TestBed.inject(BankAccountDataService)).toBeInstanceOf(InMemoryBankAccountDataService);
  });

  it('binds the product sync server to the simulated server when mock data is on', () => {
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect(TestBed.inject(ProductSyncServer)).toBeInstanceOf(InMemoryProductSyncServer);
  });

  it('leaves the product sync server unconfigured when mock data is off', () => {
    TestBed.configureTestingModule({ providers: [provideDataServices(false)] });
    expect(() => TestBed.inject(ProductSyncServer)).toThrowError(/not configured/);
  });

  it('fails clearly when no real data source is configured', () => {
    TestBed.configureTestingModule({ providers: [provideDataServices(false)] });
    expect(() => TestBed.inject(ProductDataService)).toThrowError(/not configured/);
  });
});
