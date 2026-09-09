import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FileOpener } from '@awesome-cordova-plugins/file-opener/ngx';

import { VisitasService, VisitEditContext } from './visitas.service';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { EventoVisita } from '../modelos/evento-visita';
import { IncidenceType } from '../modelos/tables/incidenceType';
import { IncidenceMotive } from '../modelos/tables/incidenceMotive';
import { VISIT_STATUS_TO_SEND, VISIT_STATUS_VISITED } from '../utils/appConstants';

describe('VisitasService', () => {
  let service: VisitasService;

  const buildDbRow = (overrides: Record<string, unknown> = {}) => ({
    id_visit: 1,
    co_visit: 'V001',
    st_visit: 3,
    da_visit: '2026-08-03 00:00:00',
    coordenada: '',
    id_client: 1,
    co_client: 'C001',
    na_client: 'Cliente',
    nu_sequence: 1,
    id_user: 1,
    co_user: 'U001',
    co_enterprise: 'E001',
    id_enterprise: 1,
    da_initial: '',
    da_real: '',
    id_address_client: 1,
    co_address_client: 'A001',
    coordenadaSaved: false,
    has_attachments: 'false',
    nu_attachments: 0,
    is_reassigned: 'false',
    tx_reassigned_motive: '',
    da_reassign: '',
    no_dispatched_motive: '',
    is_dispatched: 'false',
    is_visited: 'false',
    ...overrides,
  });

  const baseContext = (): VisitEditContext => ({
    idClient: 10,
    idAddressClient: 5,
    initialLock: false,
    fromWeb: false,
    viewOnly: false,
    fechaInitial: '2026-08-03 10:00:00',
    listaEventos: [],
    rolTransportista: false,
  });

  const buildEvent = (overrides: Partial<EventoVisita> = {}): EventoVisita => ({
    pos: 0,
    coIncid: 0,
    actividad: {
      idType: 1,
      naType: 'Visita',
      requiredEvent: false,
      requiredSignature: false,
    } as IncidenceType,
    evento: { idMotive: 1, idType: 1, naMotive: 'OK' } as IncidenceMotive,
    comentario: 'test',
    saved: false,
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FileOpener, useValue: { open: () => Promise.resolve() } },
        { provide: SynchronizationDBService, useValue: { getDatabase: () => ({}) } },
      ],
    });
    service = TestBed.inject(VisitasService);
    service.userMustActivateGPS = false;
    service.signatureVisit = false;
    service.visit = { stVisit: 0, daReal: '' } as any;
    service.coordenadas = '10,20';
    service.tags.set('VIS_MSJ_ERROR_NO_CLIENT', 'Seleccione un cliente');
    service.tags.set('VIS_MSJ_ERROR_NO_ADDRESS', 'Seleccione sucursal');
    service.tags.set('VIS_MSJ_ERROR_NOT_STARTED', 'Inicie visita');
    service.tags.set('VIS_MSJ_ERROR_NO_EVENTS', 'Agregue actividades');
    service.tags.set('VIS_MSJ_ERROR_INCOMPLETE_EVENT', 'Complete eventos');
    service.tags.set('VIS_MSJ_ERROR_NO_SIGNATURE', 'Adjunte firma');
    service.tags.set('VIS_MSJ_ERROR_NO_GPS', 'Active GPS');
    service.adjuntoService.weightLimitExceeded = false;
    spyOn(service.adjuntoService, 'hasItems').and.returnValue(true);
    spyOn(service.adjuntoService, 'tieneFirma').and.returnValue(true);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('visitDBtoObj', () => {
    it('parses has_attachments string true and nu_attachments as number', () => {
      const visit = service.visitDBtoObj(buildDbRow({
        has_attachments: 'true',
        nu_attachments: '2',
      }));

      expect(visit.hasAttachments).toBe(true);
      expect(visit.nuAttachments).toBe(2);
    });

    it('parses has_attachments false and zero attachments', () => {
      const visit = service.visitDBtoObj(buildDbRow({
        has_attachments: 'false',
        nu_attachments: 0,
      }));

      expect(visit.hasAttachments).toBe(false);
      expect(visit.nuAttachments).toBe(0);
    });

    it('parses boolean true from SQLite', () => {
      const visit = service.visitDBtoObj(buildDbRow({
        has_attachments: true,
        nu_attachments: 1,
      }));

      expect(visit.hasAttachments).toBe(true);
      expect(visit.nuAttachments).toBe(1);
    });
  });

  describe('VIS-SAVE-001 Guardar tras General válida', () => {
    it('visita nueva sin baseline permite Guardar con General válida', () => {
      service.generalTabValidForSave = true;
      service.setVisitEditContext(baseContext());
      service.resetVisitExitBaseline();
      let saveEnabled: boolean | undefined;
      service.visitValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });

    it('baseline limpio deshabilita Guardar aunque General sea válida', () => {
      service.generalTabValidForSave = true;
      service.setVisitEditContext(baseContext());
      service.visitPersistedBaseline = true;
      service.visitDirtySincePersist = false;
      let saveEnabled: boolean | undefined;
      service.visitValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);

      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeFalse();
    });

    it('markVisitDirty re-habilita Guardar tras baseline', () => {
      service.generalTabValidForSave = true;
      service.setVisitEditContext(baseContext());
      let saveEnabled: boolean | undefined;
      service.visitValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.applyVisitPersistSucceededBaseline();

      expect(saveEnabled).toBeFalse();
      service.markVisitDirty();
      service.updateSaveButtonAvailability();
      expect(saveEnabled).toBeTrue();
    });

    it('hasVisitSaveErrors false sin actividades si General OK', () => {
      service.generalTabValidForSave = true;
      service.setVisitEditContext(baseContext());

      expect(service.hasVisitSaveErrors()).toBeFalse();
      expect(service.hasVisitFieldErrors()).toBeTrue();
    });

    it('hasVisitSaveErrors true sin cliente', () => {
      const ctx = baseContext();
      ctx.idClient = null;
      service.generalTabValidForSave = false;
      service.setVisitEditContext(ctx);

      expect(service.hasVisitSaveErrors()).toBeTrue();
      expect(service.getVisitSaveValidationMessage()).toContain('Seleccione un cliente');
    });
  });

  describe('VIS-SEND-001 Enviar y validación al click', () => {
    it('Enviar ON con General válida aunque no haya eventos', () => {
      service.generalTabValidForSave = true;
      service.setVisitEditContext(baseContext());
      let sendEnabled: boolean | undefined;
      service.visitValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeTrue();
    });

    it('hasVisitFieldErrors true sin eventos', () => {
      service.generalTabValidForSave = true;
      service.setVisitEditContext(baseContext());

      expect(service.hasVisitFieldErrors()).toBeTrue();
      expect(service.getVisitValidationMessage()).toContain('Agregue actividades');
      expect(service.resolveSendValidationFocusTab()).toBe('actividades');
    });

    it('SEND-TAB-001: visita completa resolve es null y request no emite', () => {
      service.generalTabValidForSave = true;
      service.userMustActivateGPS = false;
      service.signatureVisit = false;
      const ctx = baseContext();
      ctx.listaEventos = [buildEvent()];
      service.setVisitEditContext(ctx);
      let focused: string | undefined = 'sentinel';
      service.focusSendValidationTab.subscribe((tab) => focused = tab);

      expect(service.resolveSendValidationFocusTab()).toBeNull();
      service.requestSendValidationTabFocus();
      expect(focused).toBe('sentinel');
    });

    it('sendBlockedByFields se limpia al editar (notifyVisitEdited)', () => {
      service.generalTabValidForSave = true;
      service.setVisitEditContext(baseContext());
      service.sendBlockedByFields = true;
      let sendEnabled: boolean | undefined;
      service.visitValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);
      service.updateSendButtonAvailability();
      expect(sendEnabled).toBeFalse();

      service.notifyVisitEdited();
      expect(service.sendBlockedByFields).toBeFalse();
      expect(sendEnabled).toBeTrue();
    });

    it('hasVisitFieldErrors true sin cliente', () => {
      const ctx = baseContext();
      ctx.idClient = null;
      service.generalTabValidForSave = false;
      service.setVisitEditContext(ctx);

      expect(service.hasVisitFieldErrors()).toBeTrue();
      expect(service.getVisitValidationMessage()).toContain('Seleccione un cliente');
    });

    it('fromWeb sin iniciar exige visita iniciada', () => {
      service.generalTabValidForSave = true;
      const ctx = baseContext();
      ctx.fromWeb = true;
      ctx.initialLock = true;
      ctx.listaEventos = [buildEvent()];
      service.setVisitEditContext(ctx);

      expect(service.hasVisitFieldErrors()).toBeTrue();
      expect(service.getVisitValidationMessage()).toContain('Inicie visita');
    });

    it('required_event exige motivo por línea', () => {
      service.generalTabValidForSave = true;
      const ctx = baseContext();
      ctx.listaEventos = [buildEvent({
        actividad: {
          idType: 1,
          naType: 'Visita',
          requiredEvent: 'true',
          requiredSignature: false,
        } as unknown as IncidenceType,
        evento: { idMotive: 0, idType: 1, naMotive: '' } as IncidenceMotive,
      })];
      service.setVisitEditContext(ctx);

      expect(service.hasVisitFieldErrors()).toBeTrue();
      expect(service.getVisitValidationMessage()).toContain('Complete eventos');
    });

    it('visita por enviar queda read-only', () => {
      service.visit.stVisit = VISIT_STATUS_TO_SEND;
      service.generalTabValidForSave = true;
      service.setVisitEditContext(baseContext());
      let saveEnabled: boolean | undefined;
      let sendEnabled: boolean | undefined;
      service.visitValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.visitValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSaveButtonAvailability();
      service.updateSendButtonAvailability();
      expect(saveEnabled).toBeFalse();
      expect(sendEnabled).toBeFalse();
    });

    it('visita enviada queda read-only', () => {
      service.visit.stVisit = VISIT_STATUS_VISITED;
      service.generalTabValidForSave = true;
      service.setVisitEditContext({ ...baseContext(), viewOnly: true });
      let saveEnabled: boolean | undefined;
      let sendEnabled: boolean | undefined;
      service.visitValidToSave.subscribe((v: Boolean) => saveEnabled = !!v);
      service.visitValidToSend.subscribe((v: Boolean) => sendEnabled = !!v);

      service.updateSaveButtonAvailability();
      service.updateSendButtonAvailability();
      expect(saveEnabled).toBeFalse();
      expect(sendEnabled).toBeFalse();
    });
  });

  describe('VIS-SEND-001 adjuntos signatureVisit', () => {
    beforeEach(() => {
      service.signatureVisit = true;
      service.generalTabValidForSave = true;
      const ctx = baseContext();
      ctx.listaEventos = [buildEvent()];
      service.setVisitEditContext(ctx);
    });

    it('signatureVisit no exige adjuntos (solo muestra firma)', () => {
      (service.adjuntoService.hasItems as jasmine.Spy).and.returnValue(false);

      expect(service.hasVisitFieldErrors()).toBeFalse();
    });
  });
});
