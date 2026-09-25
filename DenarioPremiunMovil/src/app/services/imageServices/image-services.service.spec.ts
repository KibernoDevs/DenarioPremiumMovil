import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { ImageServicesService } from './image-services.service';

describe('ImageServicesService', () => {
  let service: ImageServicesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(ImageServicesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
