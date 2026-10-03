import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { AppTitleStrategy } from './app-title.strategy';

@Component({ template: '', selector: 'app-title-blank' })
class BlankComponent {}

describe('AppTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'products', title: 'Products', component: BlankComponent },
          { path: 'plain', component: BlankComponent },
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy },
      ],
    });
  });

  it('adds the product name to the page title', async () => {
    await TestBed.inject(Router).navigateByUrl('/products');
    expect(TestBed.inject(Title).getTitle()).toBe('Products · ShopDesk');
  });

  it('falls back to the product name alone', async () => {
    await TestBed.inject(Router).navigateByUrl('/plain');
    expect(TestBed.inject(Title).getTitle()).toBe('ShopDesk');
  });
});
