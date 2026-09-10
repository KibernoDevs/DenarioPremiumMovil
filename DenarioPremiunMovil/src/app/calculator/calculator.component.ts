import { Component, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { Subscription } from 'rxjs/internal/Subscription';
import { Enterprise } from '../modelos/tables/enterprise';
import { ConversionService } from '../services/conversion/conversion.service';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Conversion } from '../modelos/tables/conversion';
import { DraggableFabDirective } from '../directives/draggable-fab.directive';

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, DraggableFabDirective],
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss'],
})
export class CalculatorComponent implements OnInit {


  public conversionService = inject(ConversionService);
  public globalConfig = inject(GlobalConfigService);

  public sub!: Subscription;

  // Calculadora global
  public showCalculator: boolean = false;
  public expression: string = '';
  public lastResult: string | number | null = null;
  // Mostrar FAB sólo en rutas permitidas (por defecto, home)
  public showFab: boolean = false;
  // Inputs para el panel de calculadora/selector
  public inputsIdx: number[] = [0, 1, 2];
  public inputs: string[] = ['', '', ''];
  public companies: Enterprise[] = [];
  public selectedCompany: Enterprise | null = null;
  public rates: Conversion[] = [];
  public selectedRates: Conversion[] = [];
  public selectedRatesValues: { idConversion: number; naConversion: string; value: number }[] = [];

  public baseUSD: number = 0;
  public calcularIVA: boolean = true; // checkbox default true
  public ivaUSDInput: string = '16,00'; // mostrado (porcentaje con coma)
  public ivaPercent: number = 16;       // valor numérico 0..100 (porcentaje)
  public descuentoUSD: number = 0;
  public totalUSD: number = 0;
  public totalIVAUSD: number = 0;
  public descuentoUSDInput: string = '0,00'; // input mostrado (porcentaje, con coma decimal)
  public descuentoPercent: number = 0;       // valor numérico (0..100)
  // Tasas (configurables) para calcular totales en moneda local/alternativa
  public tasaBcvRate: number = 1;
  public tasaParaleloRate: number = 1;
  public totalTasaBCV: number = 0;
  public totalTasaParaleloUSD: number = 0;

  // Nuevo binding auxiliar (string) para el input formateado
  public baseUSDInput: string = '0,00'; // ahora con coma por defecto

  constructor(
    private router: Router
  ) { }

  ngOnInit() {
    // Suscribirse y guardar la suscripción para desuscribir luego
    this.sub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.updateFabVisibility());

    /* this.showFab = this.globalConfig.get('conversionCalculator') == 'true' ? true : false; */
    // Inicializar visibilidad del FAB y suscribirse a cambios de ruta
    this.updateFabVisibility();

    // Inicializar valores y formatear baseUSDInput
    this.baseUSD = Number(this.baseUSD) || 0;
    this.baseUSDInput = this.formatCurrencyLocale(this.baseUSD);

    // Inicializa el descuento por defecto (0) y mostrar con mismo formateo que baseUSDInput
    this.descuentoPercent = Number(this.descuentoPercent) || 0;
    this.descuentoUSDInput = this.formatCurrencyLocale(this.descuentoPercent);

    // Inicializa IVA por defecto (16%) y mostrar con mismo formateo
    this.ivaPercent = Number(this.ivaPercent) || 16;
    this.ivaUSDInput = this.formatCurrencyLocale(this.ivaPercent);

    // Inicializar cálculos de la calculadora
    this.recalcTotals();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }


  // Toggle visible/invisible
  toggleCalculator() {
    const conv = this.globalConfig.get('conversionCalculator');
    const convEnabled = (typeof conv === 'boolean')
      ? conv
      : String(conv).toLowerCase() === 'true';
    if (!convEnabled) return; // no abrir si la feature está desactivada

    this.showCalculator = !this.showCalculator;
    if (this.showCalculator) {
      // cargar datos al abrir
      this.loadEnterprises().then(() => {
        this.loadRates().then(() => {
          this.BCVRate().then(() => {
            console.log('Calculator data loaded');
          });
        });
      });
    }
  }

  private updateFabVisibility(): void {
    try {
      const url = (this.router?.url ?? '').toLowerCase();
      const isCobrosRoute = url.includes('/cobros');

      const conv = this.globalConfig.get('conversionCalculator');
      const convEnabled = (typeof conv === 'boolean')
        ? conv
        : String(conv).toLowerCase() === 'true';

      this.showFab = convEnabled && isCobrosRoute;

      if (!convEnabled || !isCobrosRoute) {
        this.showCalculator = false;
      }
    } catch (e) {
      this.showFab = false;
    }
  }

  onCompanyChange(event: any) {
    const id = event?.detail?.value ?? event;
    this.selectedCompany = event?.detail?.value || null;

    // Reset numeric state
    this.baseUSD = 0;
    this.baseUSDInput = this.formatCurrencyLocale(0);

    this.descuentoUSD = 0;
    this.descuentoUSDInput = this.formatCurrencyLocale(0);
    this.descuentoPercent = 0;

    // IVA: restablecer al valor por defecto (16) o ajustar según tu lógica
    this.ivaPercent = 16;
    this.ivaUSDInput = this.formatCurrencyLocale(this.ivaPercent);
    this.totalIVAUSD = 0;

    this.totalUSD = 0;

    // Tasas y totales relacionados
    this.tasaBcvRate = 1;
    this.tasaParaleloRate = 1;
    this.totalTasaBCV = 0;
    this.totalTasaParaleloUSD = 0;

    // Rates / selections
    this.selectedRates = [];
    this.rates = [];
    this.selectedRatesValues = [];

    // Cargar rates y tasa BCV luego recalcular totales
    this.loadRates().then(() => {
      this.BCVRate().then(() => {
        this.recalcTotals();
      }).catch(() => this.recalcTotals());
    }).catch(() => {
      // asegurar recalculo aunque la carga falle
      this.recalcTotals();
    });
  }

  public loadRates() {
    return this.conversionService.getRates(Number(this.selectedCompany?.idEnterprise)).then(rates => {
      console.log('Rates loaded in calculator:', rates);
      this.rates = rates;
      return Promise.resolve(true);
    });
  }

  public BCVRate() {
    return this.conversionService.getTasaBCV(Number(this.selectedCompany?.idEnterprise)).then(rate => {
      this.tasaBcvRate = rate;
      return Promise.resolve(true);
    });
  }

  public loadEnterprises() {
    return this.conversionService.getEnterprise().then(companies => {
      this.selectedCompany = companies[0];
      this.companies = companies;
      return Promise.resolve(true);
    });
  }

  public onRatesChange(event: any) {
    // Ionic ion-select con multiple devuelve un array en event.detail.value
    const val = event?.detail?.value ?? event;

    if (Array.isArray(val)) {
      this.selectedRates = val as Conversion[];
    } else if (val) {
      // si el control no está en modo multiple puede venir un único objeto
      this.selectedRates = [val as Conversion];
    } else {
      this.selectedRates = [];
    }

    // Si no hay empresa seleccionada o no hay tasas seleccionadas, limpiamos valores
    if (!this.selectedCompany || this.selectedRates.length === 0) {
      this.selectedRatesValues = [];
      console.log('Rates changed (selectedRates cleared):', this.selectedRates);
      return;
    }

    // Convertimos cada tasa seleccionada a una promesa que obtiene su valor (nu_value_local)
    const idEnterprise = Number(this.selectedCompany.idEnterprise);

    const promises = this.selectedRates.map(r => {
      const idConv = Number(r.idConversion);
      const naConv = r.naConversion;
      return this.conversionService.getRate(idConv, idEnterprise).then(value => {
        return { idConversion: idConv, naConversion: naConv, value: value.nu_value_local };
      }).catch(err => {
        console.warn('Error cargando rate value for', idConv, err);
        return { idConversion: idConv, naConversion: naConv, value: 0 };
      });
    });

    // Esperamos a todas las promesas y reasignamos selectedRatesValues (reemplaza lo anterior)
    Promise.all(promises).then(results => {
      this.selectedRatesValues = results;
      console.log('selectedRatesValues updated:', this.selectedRatesValues);
    }).catch(err => {
      console.warn('Error resolviendo rates promises', err);
      // en fallo general, limpiamos para mantener consistencia
      this.selectedRatesValues = [];
    });

    console.log('Rates changed (selectedRates):', this.selectedRates);
  }

  public computeRateTotal(rate: Conversion): number {
    const total = Number(this.totalUSD) || 0;
    const rateFactor = rate?.primaryCurrency ? Number(this.tasaBcvRate) || 1 : Number(this.tasaParaleloRate) || 1;
    return Math.round((total * rateFactor + Number.EPSILON) * 100) / 100;
  }

  public recalcTotals(): void {
    try {
      const base = Number(this.baseUSD) || 0;

      const ivaPct = Number(this.ivaPercent) || 0; // usa ivaPercent numérico

      if (this.calcularIVA) {
        // IVA en USD = base * (ivaPct / 100)
        this.totalIVAUSD = Math.round((base * ivaPct / 100) * 100) / 100;
      } else {
        this.totalIVAUSD = 0;
      }

      const descuentoPct = Number(this.descuentoPercent) || 0; // 0..100
      // descuento en USD = base * (descuentoPct / 100)
      this.descuentoUSD = Math.round(base * (descuentoPct / 100));

      // Si el descuento iguala la base, anular IVA (mantener consistencia numérica)
      if (Number(this.descuentoUSDInput) === base && base != 0) {
        this.ivaPercent = 0;
        this.ivaUSDInput = this.formatCurrencyLocale(0);
        this.totalIVAUSD = 0;
      }

      // total USD con valores calculados (usar totalIVAUSD numérico)
      this.totalUSD = Math.round((base + this.totalIVAUSD - this.descuentoUSD) * 100) / 100;

      const total = base + this.totalIVAUSD - this.descuentoUSD;
      // redondeos para presentar
      this.totalTasaBCV = Math.round((total * this.tasaBcvRate) * 100) / 100;
      this.totalTasaParaleloUSD = Math.round((total * this.tasaParaleloRate) * 100) / 100;
    } catch (e) {
      console.warn('[recalcTotals] error', e);
    }
  }

  // Formatea porcentaje para mostrar (coma decimal, 2 decimales), ej. 4 -> "4,00"
  private formatPercentLocale(value: number): string {
    if (value == null || Number.isNaN(value)) return '0,00';
    const negative = value < 0;
    const abs = Math.abs(value);
    const dec = (Math.round(abs * 100) / 100).toFixed(2); // "4.00"
    // Reemplazar punto decimal por coma
    return (negative ? '-' : '') + dec.replace('.', ',');
  }

  /**
   * Formatea un número para mostrarlo con punto miles y coma decimales.
   * Ejemplos: 0 -> "0,00", 1234.5 -> "1.234,50"
   */
  public formatCurrencyLocale(value: number): string {
    if (value == null || Number.isNaN(value)) return '0,00';
    const negative = value < 0;
    const abs = Math.abs(value);
    const parts = abs.toFixed(2).split('.'); // ["1234","56"]
    let intPart = parts[0];
    const decPart = parts[1] ?? '00';
    // Insertar puntos cada 3 dígitos desde la derecha
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (negative ? '-' : '') + intPart + ',' + decPart;
  }

  /**
   * Maneja la entrada del porcentaje de descuento en modo "centavos persistentes".
   * Comportamiento: cada dígito que ingresas se añade como centavo:
   *  - escribe "1"  => 0,01  (descuentoPercent = 0.01)
   *  - sigue con "2" => 0,12  (descuentoPercent = 0.12)
   *  - sigue con "3" => 1,23  (descuentoPercent = 1.23)
   * El valor se clampa en 0..100 (si se pasan más dígitos y supera 100 se ajusta a 100).
   */
  public onDescuentoInput(ev: any): void {
    try {
      // obtener raw value del input (Ionic: ev.detail.value)
      const raw = ev?.detail?.value ?? ev?.target?.value ?? String(ev ?? '');
      // extraer sólo dígitos (quitamos cualquier punto/coma/espacio)
      const digits = String(raw).replace(/\D/g, '');

      // si no hay dígitos, tratamos como 0
      const normalized = digits === '' ? '0' : digits;

      // interpretar como centavos: '1' -> 0.01, '123' -> 1.23
      let valueNumber = parseInt(normalized, 10) / 100;

      // clamp entre 0 y 100 (porcentaje máximo)
      if (!Number.isFinite(valueNumber) || Number.isNaN(valueNumber)) valueNumber = 0;
      valueNumber = Math.max(0, Math.min(100.00, valueNumber));

      // Actualizamos el porcentaje numérico y la cadena mostrada (mismo formateo que baseUSD)
      this.descuentoPercent = valueNumber;
      this.descuentoUSDInput = this.formatCurrencyLocale(this.descuentoPercent);

      // Recalcular totales usando el nuevo porcentaje
      this.recalcTotals();
    } catch (err) {
      console.warn('[onDescuentoInput] parse error', err);
      this.descuentoPercent = 0;
      this.descuentoUSDInput = this.formatCurrencyLocale(0);
      this.recalcTotals();
    }
  }
  
  // Reemplaza el onBaseInput por este (interpreta input como centavos, muestra con . y ,)
  public onBaseInput(ev: any): void {
    try {
      // obtener valor (Ionic usa ev.detail.value)
      const raw = ev?.detail?.value ?? ev?.target?.value ?? String(ev ?? '');
      // extraer sólo dígitos (ignoramos puntos/comas/espacios)
      const digits = String(raw).replace(/\D/g, '');

      // si no hay dígitos, tratamos como 0
      const normalized = digits === '' ? '0' : digits;

      // interpretar como centavos: '1' -> 0.01, '123' -> 1.23, '12345' -> 123.45
      const valueNumber = parseInt(normalized, 10) / 100;

      // actualizar modelo numérico usado por recalcTotals
      this.baseUSD = Number(valueNumber) || 0;

      // actualizar la cadena mostrada con formato "1.234,56"
      this.baseUSDInput = this.formatCurrencyLocale(this.baseUSD);

      // recalcular totales con el nuevo valor numérico
      this.recalcTotals();
    } catch (err) {
      console.warn('[onBaseInput] parse error', err);
      this.baseUSD = 0;
      this.baseUSDInput = '0,00';
      this.recalcTotals();
    }
  }

  append(char: string) {
    // Evitar múltiples puntos consecutivos en el mismo número (simple guard)
    if (char === '.') {
      // encontrar el último token numérico
      const tokens = this.expression.split(/[\+\-\*\/]/);
      const last = tokens[tokens.length - 1] || '';
      if (last.includes('.')) {
        return; // ya hay un punto en el número actual
      }
    }
    this.expression = (this.expression || '') + char;
  }

  clear() {
    this.expression = '';
    this.lastResult = null;
  }

  backspace() {
    if (!this.expression) return;
    this.expression = this.expression.slice(0, -1);
  }

  calculate() {
    if (!this.expression) return;
    try {
      // Evaluación simple: usar Function en vez de eval por control un poco mayor
      // Nota: sólo para uso local / app controlada; evita usar con input no confiable.
      const safeExpr = this.expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/[^0-9+\-*/().]/g, '');
      // evitar expresiones vacías después del clean
      if (!safeExpr) return;
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${safeExpr});`)();
      // Formatear resultado si es número
      if (typeof result === 'number' && !Number.isNaN(result) && Number.isFinite(result)) {
        // limitar decimales a 8 para evitar longitudes enormes
        const rounded = Math.round((result + Number.EPSILON) * 1e8) / 1e8;
        this.lastResult = rounded;
        this.expression = String(rounded);
      } else {
        this.lastResult = String(result);
        this.expression = String(result);
      }
    } catch (e) {
      console.warn('Error calculando expresión', e);
      this.lastResult = 'Err';
    }
  }

  /**
 * Maneja la entrada del IVA en modo "centavos persistentes".
 * Igual comportamiento que onDescuentoInput:
 * - cada dígito se añade como centavo (1 -> 0,01 ; next 2 -> 0,12 ; next 3 -> 1,23 ...)
 * - clamp 0..100
 * - actualiza ivaPercent y muestra ivaUSDInput con formatCurrencyLocale
 */
  public onIVAInput(ev: any): void {
    try {
      const raw = ev?.detail?.value ?? ev?.target?.value ?? String(ev ?? '');
      // extraer sólo dígitos (quitamos cualquier punto/coma/espacio)
      const digits = String(raw).replace(/\D/g, '');
      const normalized = digits === '' ? '0' : digits;

      // interpretar como centavos: '1' -> 0.01, '123' -> 1.23
      let valueNumber = parseInt(normalized, 10) / 100;

      // clamp entre 0 y 100 (porcentaje máximo)
      if (!Number.isFinite(valueNumber) || Number.isNaN(valueNumber)) valueNumber = 0;
      valueNumber = Math.max(0, Math.min(100.00, valueNumber));

      // actualizar porcentaje numérico y cadena mostrada (formato con puntos y coma)
      this.ivaPercent = valueNumber;
      this.ivaUSDInput = this.formatCurrencyLocale(this.ivaPercent);

      // recalcular totales
      this.recalcTotals();
    } catch (err) {
      console.warn('[onIVAInput] parse error', err);
      this.ivaPercent = 0;
      this.ivaUSDInput = this.formatCurrencyLocale(0);
      this.recalcTotals();
    }
  }

  closeCalculator() {
    this.showCalculator = false;
  }

  public get baseInvalid(): boolean {
    // baseUSD mantiene el valor numérico usado para cálculos (actualizado por onBaseInput)
    const numeric = Number(this.baseUSD) || 0;
    return numeric === 0;
  }

  /**
   * Devuelve el valor (nu_value_local) asociado a la tasa `rate`.
   * Si ya lo cargamos en `selectedRatesValues` lo usamos, si no usamos
   * como fallback la tasa global BCV / Paralelo según primaryCurrency.
   */
  public getSelectedRateValue(rate: Conversion): number {
    const idConv = Number(rate?.idConversion);
    const found = this.selectedRatesValues.find(s => Number(s.idConversion) === idConv);
    if (found && Number.isFinite(found.value)) {
      return Number(found.value);
    }
    // fallback: si la tasa es primaria (1) usar BCV, si no usar paralelo
    return rate?.primaryCurrency ? Number(this.tasaBcvRate || 1) : Number(this.tasaParaleloRate || 1);
  }

  /** Total USD convertido usando el valor de la tasa seleccionada */
  public computeConvertedTotal(rate: Conversion): number {
    const total = Number(this.totalUSD) || 0;
    const rateValue = this.getSelectedRateValue(rate) || 1;
    return Math.round((total * rateValue + Number.EPSILON) * 100) / 100;
  }

}