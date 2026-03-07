import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { StocksComponent } from './stocks.component';
import { StocksService } from 'app/shared/services/stocks.service';
import { AuthService } from 'app/shared/services/auth.service';
import { ProductService } from 'app/shared/services/product.service';
import { DistributorService } from 'app/shared/services/distributor.service';
import { PurchaseService } from 'app/shared/services/purchase.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

describe('StocksComponent', () => {
  let component: StocksComponent;
  let fixture: ComponentFixture<StocksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StocksComponent],
      providers: [
        {
          provide: StocksService,
          useValue: {
            getStocks: () => of({ data: [], totalItems: 0, summary: {} }),
            getTransactions: () => of({ data: [], totalItems: 0 }),
            getCurrentReconciliation: () => of({ data: null }),
            startReconciliation: () => of({ data: null, message: 'ok' }),
            saveReconciliationLines: () => of({ data: null }),
            submitReconciliation: () => of({ data: null, message: 'ok' }),
            approveReconciliation: () => of({ data: null, message: 'ok' }),
            manualAdjust: () => of({ message: 'ok' }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () => ({ role: 'ADMIN', shop: 'shop-1' }),
            getUserRole: () => 'ADMIN',
            getShopId: () => 'shop-1',
          },
        },
        {
          provide: ProductService,
          useValue: {
            getAllProducts: () => of({ products: [] }),
          },
        },
        {
          provide: DistributorService,
          useValue: {
            getDistributor: () => of({ distributors: [] }),
          },
        },
        {
          provide: PurchaseService,
          useValue: {
            createDraft: () => of({ message: 'ok' }),
          },
        },
        {
          provide: MatSnackBar,
          useValue: {
            open: () => undefined,
          },
        },
        {
          provide: MatDialog,
          useValue: {
            open: () => ({
              afterClosed: () => of(null),
            }),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: () => Promise.resolve(true),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(StocksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
