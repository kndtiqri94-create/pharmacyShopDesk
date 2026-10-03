import { TestBed } from '@angular/core/testing';
import { InMemoryProductDataService } from './in-memory/in-memory-product-data.service';
import { provideDataServices } from './data-providers';
import { ProductDataService } from './product-data.service';

describe('provideDataServices', () => {
  it('binds the in-memory implementations when mock data is on', () => {
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect(TestBed.inject(ProductDataService)).toBeInstanceOf(InMemoryProductDataService);
  });

  it('fails clearly when no real data source is configured', () => {
    TestBed.configureTestingModule({ providers: [provideDataServices(false)] });
    expect(() => TestBed.inject(ProductDataService)).toThrowError(/not configured/);
  });
});
