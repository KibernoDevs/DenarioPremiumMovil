import { TestBed } from '@angular/core/testing';

import { ServicesService } from './services.service';

describe('ServicesService', () => {
  let service: ServicesService;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServicesService);
    fetchSpy = spyOn(window, 'fetch');
    spyOn(service, 'getHttpOptionsAuthorization').and.returnValue({
      url: 'https://example.com/api/',
      headers: { Authorization: 'Bearer token' },
    } as any);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('resolveMimeTypeFromFilename should return pdf mime for pdf files', () => {
    expect(service.resolveMimeTypeFromFilename('doc.pdf', 'file')).toBe('application/pdf');
    expect(service.resolveMimeTypeFromFilename('photo.png', 'attach')).toBe('image/png');
  });

  it('sendImage should reject HTTP 500 responses', async () => {
    fetchSpy.and.callFake((input: RequestInfo) => {
      if (typeof input === 'string' && input.startsWith('data:')) {
        return Promise.resolve({
          blob: async () => new Blob(['x'], { type: 'image/jpeg' }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ errorCode: '500', errorMessage: 'Server error' }),
      } as Response);
    });

    await expectAsync(
      service.sendImage('cobros', '10', '0', 'abc', 'COB_0.jpg', 'attach', 1),
    ).toBeRejectedWithError('Server error');
  });

  it('sendImage should reject non-000 errorCode', async () => {
    fetchSpy.and.callFake((input: RequestInfo) => {
      if (typeof input === 'string' && input.startsWith('data:')) {
        return Promise.resolve({
          blob: async () => new Blob(['x'], { type: 'image/jpeg' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ errorCode: '066', errorMessage: 'Rejected' }),
      } as Response);
    });

    await expectAsync(
      service.sendImage('cobros', '10', '0', 'abc', 'COB_0.jpg', 'attach', 1),
    ).toBeRejectedWithError('Rejected');
  });

  it('sendImage should resolve when HTTP ok and errorCode is 000', async () => {
    fetchSpy.and.callFake((input: RequestInfo) => {
      if (typeof input === 'string' && input.startsWith('data:')) {
        return Promise.resolve({
          blob: async () => new Blob(['x'], { type: 'image/jpeg' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          errorCode: '000',
          errorMessage: 'OK',
          name: '10_0.jpg',
          transaction: 'cobros',
          type: 'attach',
        }),
      } as Response);
    });

    const result = await service.sendImage('cobros', '10', '0', 'abc', 'COB_0.jpg', 'attach', 1);
    expect(result.errorCode).toBe('000');
  });
});
