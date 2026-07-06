import { TestBed } from '@angular/core/testing';
import { Directory, Filesystem } from '@capacitor/filesystem';

import { AdjuntoService } from './adjunto.service';
import { ServicesService } from '../services/services.service';

describe('AdjuntoService', () => {
  let service: AdjuntoService;
  let servicesServ: jasmine.SpyObj<ServicesService>;
  let dbServ: { executeSql: jasmine.Spy };

  beforeEach(() => {
    servicesServ = jasmine.createSpyObj('ServicesService', ['sendImage', 'getTags']);
    servicesServ.getTags.and.resolveTo([]);

    dbServ = {
      executeSql: jasmine.createSpy('executeSql').and.resolveTo({ rows: { length: 0, item: () => ({}) } }),
    };

    TestBed.configureTestingModule({});
    service = TestBed.inject(AdjuntoService);
    (service as any).servicesServ = servicesServ;
    localStorage.setItem('connected', 'true');
  });

  afterEach(() => {
    localStorage.removeItem('connected');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deletePendingTransactionAttachmentsByKey should delete by co_transaction and filename', async () => {
    dbServ.executeSql.and.resolveTo({});

    const result = await service.deletePendingTransactionAttachmentsByKey(
      dbServ as any,
      'COB-001',
      'COB-001_Signature.jpg',
      'signature',
    );

    expect(result).toBeTrue();
    expect(dbServ.executeSql).toHaveBeenCalledWith(
      'DELETE FROM pending_transactions_attachments WHERE co_transaction = ? AND na_attachment = ? AND type = ?;',
      ['COB-001', 'COB-001_Signature.jpg', 'signature'],
    );
  });

  it('upload flow should not delete pending row when sendImage fails', async () => {
    spyOn(Filesystem, 'readFile').and.resolveTo({ data: 'base64data' } as any);
    servicesServ.sendImage.and.rejectWith(new Error('upload failed'));
    const deleteSpy = spyOn(service, 'deletePendingTransactionAttachmentsByKey').and.resolveTo(true);
    const recordSpy = spyOn(service as any, 'recordUploadAttemptFailure').and.resolveTo();

    const uploadFn = (service as any).uploadPendingAttachment.bind(service);
    const success = await uploadFn(dbServ as any, {
      naTransaction: 'cobros',
      idTransaction: 99,
      coTransaction: 'COB-001',
      naAttachment: 'COB-001_0.jpg',
      type: 'attach',
      position: 0,
      cantidad: 1,
    });

    expect(success).toBeFalse();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(recordSpy).toHaveBeenCalled();
    expect(servicesServ.sendImage).toHaveBeenCalledWith(
      'cobros',
      '99',
      '0',
      'base64data',
      'COB-001_0.jpg',
      'attach',
      1,
      'image/jpeg',
    );
  });

  it('upload flow should delete pending row only after successful sendImage', async () => {
    spyOn(Filesystem, 'readFile').and.resolveTo({ data: 'base64data' } as any);
    servicesServ.sendImage.and.resolveTo({ errorCode: '000' });
    const deleteSpy = spyOn(service, 'deletePendingTransactionAttachmentsByKey').and.resolveTo(true);

    const uploadFn = (service as any).uploadPendingAttachment.bind(service);
    const success = await uploadFn(dbServ as any, {
      naTransaction: 'cobros',
      idTransaction: 99,
      coTransaction: 'COB-001',
      naAttachment: 'COB-001_Signature.jpg',
      type: 'signature',
      position: 0,
      cantidad: 0,
    });

    expect(success).toBeTrue();
    expect(deleteSpy).toHaveBeenCalledWith(
      dbServ as any,
      'COB-001',
      'COB-001_Signature.jpg',
      'signature',
    );
  });

  it('resolveServerTransactionId should read collection id for cobros', async () => {
    dbServ.executeSql.and.resolveTo({
      rows: {
        length: 1,
        item: () => ({ id: 42 }),
      },
    });

    const id = await service.resolveServerTransactionId(dbServ as any, 'COB-001', 'cobros');
    expect(id).toBe(42);
  });
});
