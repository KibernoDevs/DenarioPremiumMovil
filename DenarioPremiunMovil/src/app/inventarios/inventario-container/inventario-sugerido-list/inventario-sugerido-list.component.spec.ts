import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { InventarioSugeridoListComponent } from './inventario-sugerido-list.component';
import {
  configureIonicComponentTestingModule,
  createShallowComponentFixture,
} from 'src/app/testing/ionic-component-spec.helpers';

describe('InventarioSugeridoListComponent', () => {
  let component: InventarioSugeridoListComponent;
  let fixture: ComponentFixture<InventarioSugeridoListComponent>;

  beforeEach(waitForAsync(() => {
    configureIonicComponentTestingModule(InventarioSugeridoListComponent).compileComponents();
  }));

  beforeEach(() => {
    ({ fixture, component } = createShallowComponentFixture(InventarioSugeridoListComponent));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
