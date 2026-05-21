import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { InventarioSugeridoPreviewComponent } from './inventario-sugerido-preview.component';

describe('InventarioSugeridoPreviewComponent', () => {
  let component: InventarioSugeridoPreviewComponent;
  let fixture: ComponentFixture<InventarioSugeridoPreviewComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ InventarioSugeridoPreviewComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(InventarioSugeridoPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
