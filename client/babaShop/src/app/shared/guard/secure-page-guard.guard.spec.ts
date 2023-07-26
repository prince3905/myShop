import { TestBed } from '@angular/core/testing';

import { SecurePageGuardGuard } from './secure-page-guard.guard';

describe('SecurePageGuardGuard', () => {
  let guard: SecurePageGuardGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(SecurePageGuardGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
