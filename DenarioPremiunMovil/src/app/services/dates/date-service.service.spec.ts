import { TestBed } from '@angular/core/testing';

import { DateServiceService } from './date-service.service';

describe('DateServiceService', () => {
  let service: DateServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DateServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('toDbDateTime convierte ISO con T a formato WS', () => {
    expect(service.toDbDateTime('2026-09-11T04:00:00')).toBe('2026-09-11 04:00:00');
  });

  it('toDbDateTime conserva datetime con espacio', () => {
    expect(service.toDbDateTime('2026-09-11 11:21:52')).toBe('2026-09-11 11:21:52');
  });
});
