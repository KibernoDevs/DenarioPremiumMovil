import { TestBed } from '@angular/core/testing';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AuthBearerInterceptor } from '../../interceptors/auth-bearer.interceptor';
import { ServicesService } from '../services.service';
import { DownloadFileHttpService } from './download-file-http.service';

describe('DownloadFileHttpService (HTTP auth)', () => {
  let httpMock: HttpTestingController;
  let downloadFileHttp: DownloadFileHttpService;
  let services: ServicesService;

  beforeEach(() => {
    (window as Window & { __env?: Record<string, string> }).__env = {
      WsUrl: 'https://api.example.com/services/',
    };
    localStorage.setItem('token', 'session-jwt-token');
    localStorage.setItem('coUser', 'VEND01');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthBearerInterceptor, multi: true },
        ServicesService,
        DownloadFileHttpService,
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    downloadFileHttp = TestBed.inject(DownloadFileHttpService);
    services = TestBed.inject(ServicesService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should append Authorization Bearer header on GET /services/download/files', () => {
    downloadFileHttp.downloadDispatchFile('dispatch.pdf').subscribe();

    const req = httpMock.expectOne((request) =>
      request.url.includes('/services/download/files') && request.method === 'GET',
    );

    expect(req.request.headers.get('Authorization')).toBe('Bearer session-jwt-token');
    expect(req.request.url).toContain('nameFile=dispatch.pdf');
    expect(req.request.url).toContain('coUser=VEND01');

    req.flush(new ArrayBuffer(8));
  });

  it('should build download URL with coUser from active session', () => {
    const url = services.buildDispatchFileDownloadUrl('report.pdf');
    expect(url).toContain('coUser=VEND01');
    expect(url).toContain('nameFile=report.pdf');
    expect(url).toContain('type=files');
  });

  it('should reject coUser that does not match active session', () => {
    expect(() => services.buildDispatchFileDownloadUrl('report.pdf', 'OTHER_USER')).toThrowError(
      /coUser does not match active session/,
    );
  });
});
