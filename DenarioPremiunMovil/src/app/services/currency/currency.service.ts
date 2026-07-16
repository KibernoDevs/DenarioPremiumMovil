import { Injectable, inject } from '@angular/core';

import { CurrencyEnterprise } from 'src/app/modelos/tables/currencyEnterprise';
import { GlobalConfigService } from '../globalConfig/global-config.service';
import { Observable } from 'rxjs';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { DateServiceService } from '../dates/date-service.service';
//import { DateServiceService } from '../dates/date-service.service';
import { CurrencyModules } from 'src/app/modelos/tables/currencyModules';




@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  //injects  
  private globalConfig = inject(GlobalConfigService);
  private dateService = inject(DateServiceService);

  public multimoneda: any;
  public localCurrency!: CurrencyEnterprise;
  public hardCurrency!: CurrencyEnterprise;
  public currencyRelation: any;
  public localValue: any;
  public currencyModulesMap = new Map<string, CurrencyModules>();

  public precision: number = 0;

  constructor(


  ) {
    this.precision = Number.parseInt(this.globalConfig.get('parteDecimal'));

  }

  async setup(db: SQLiteObject): Promise<void> {
    if (this.globalConfig.get("currencyModule") === "true") {
      this.currencyModulesMap = await this.getCurrencyModules(db);
    }

    this.multimoneda = this.globalConfig.get("multiCurrency") === "true";

    const needsLocalCurrency = this.localCurrency == null;
    const needsHardCurrency = this.multimoneda && this.hardCurrency == null;
    const needsRates = this.multimoneda
      && (this.currencyRelation == null || this.localValue == null
        || !this.isValidExchangeFactor(this.currencyRelation)
        || !this.isValidExchangeFactor(this.localValue));

    if (!needsLocalCurrency && !needsHardCurrency && !needsRates) {
      return;
    }

    if (needsLocalCurrency) {
      await this.queryLocalCurrency(db);
    }
    if (this.multimoneda) {
      const rateQueries: Promise<void>[] = [];
      if (needsHardCurrency) {
        rateQueries.push(this.queryHardCurrency(db));
      }
      if (needsRates || this.currencyRelation == null) {
        rateQueries.push(this.queryCurrencyRelation(db));
      }
      if (needsRates || this.localValue == null) {
        rateQueries.push(this.queryLocalValue(db));
      }
      await Promise.all(rateQueries);
    }
  }

  formatNumber(input: number) {
    // Formatea un número a la moneda local y con la precisión correcta
    this.precision = Number.parseInt(this.globalConfig.get('parteDecimal'));
    if (isNaN(input)) input = 0;

    // Validar precisión
    let precision = Number(this.precision);
    if (isNaN(precision) || precision < 0 || precision > 20) {
      precision = 2; // Valor por defecto seguro
    }

    return Intl.NumberFormat("es-VE", {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    }).format(input);
  }

  public isLocalCurrency(coCurrency: string): boolean {
    return coCurrency === this.localCurrency.coCurrency;
  }

  public isHardCurrency(coCurrency: string): boolean {
    return this.multimoneda && coCurrency === this.hardCurrency.coCurrency;
  }
  getCurrencyModule(coModule: string): CurrencyModules {
    //Obtiene la configuración de moneda para un modulo segun su coModule
    var cm = this.currencyModulesMap.get(coModule);
    if (cm) {
      return cm;
    } else {
      console.warn("[CurrencyService] No se encontró el módulo de moneda: " + coModule);
      return new CurrencyModules(0, 0, true, true, true); // Valor por defecto
    }
  }

  toOppositeCurrency(coCurrency: string, amount: number) {
    //Convierte de una moneda a otra
    //console.log("[CurrencyService] toOppositeCurrency: " + coCurrency + " " + amount);
    if (this.multimoneda) {
      if (coCurrency === this.localCurrency.coCurrency) {
        return this.toHardCurrency(amount);
      } else {
        return this.toLocalCurrency(amount);
      }
    } else {
      return amount;
    }
  }

  convertFrom(price: number, coCurrency: string){
    //Convierte un precio a la moneda opuesta a coCurrency;
    if(this.isLocalCurrency(coCurrency)){
      return this.formatNumber(this.toHardCurrency(price));
    }else{
      return this.formatNumber(this.toLocalCurrency(price));
    }
  }

  private isValidExchangeFactor(value: unknown): boolean {
    const n = Number(value);
    return Number.isFinite(n) && n > 0;
  }

  private resolveExchangeFactors(): { localValue: number; currencyRelation: number } | null {
    const localValue = Number(this.localValue);
    const currencyRelation = Number(this.currencyRelation);
    if (!this.isValidExchangeFactor(localValue) || !this.isValidExchangeFactor(currencyRelation)) {
      return null;
    }
    return { localValue, currencyRelation };
  }

  toLocalCurrency(hardAmount: number): number {
    const amount = Number(hardAmount);
    if (!Number.isFinite(amount)) {
      return 0;
    }
    const factors = this.resolveExchangeFactors();
    if (!factors) {
      return 0;
    }
    const converted = (amount * factors.localValue) / factors.currencyRelation;
    return Number.isFinite(converted) ? converted : 0;
  }

  toHardCurrency(localAmount: number): number {
    const amount = Number(localAmount);
    if (!Number.isFinite(amount)) {
      return 0;
    }
    const factors = this.resolveExchangeFactors();
    if (!factors) {
      return 0;
    }
    const converted = (amount * factors.currencyRelation) / factors.localValue;
    return Number.isFinite(converted) ? converted : 0;
  }

  toLocalCurrencyByNuValueLocal(hardAmount: number, nuValueLocal: number): number {
    const amount = Number(hardAmount);
    const rate = Number(nuValueLocal);
    const relation = Number(this.currencyRelation);
    if (!Number.isFinite(amount) || !this.isValidExchangeFactor(rate) || !this.isValidExchangeFactor(relation)) {
      return 0;
    }
    return this.cleanFormattedNumber(this.formatNumber((amount * rate) / relation));
  }

  toHardCurrencyByNuValueLocal(localAmount: number, nuValueLocal: number): number {
    const amount = Number(localAmount);
    const rate = Number(nuValueLocal);
    const relation = Number(this.currencyRelation);
    if (!Number.isFinite(amount) || !this.isValidExchangeFactor(rate) || !this.isValidExchangeFactor(relation)) {
      return 0;
    }
    return this.cleanFormattedNumber(this.formatNumber((amount * relation) / rate));
  }

  getCurrencyById(idCurrency: number | null): CurrencyEnterprise {
    if (idCurrency == null) {
      return this.getLocalCurrency();
    }
    if (this.multimoneda) {
      if (idCurrency === this.localCurrency.idCurrency) {
        return this.localCurrency;
      }
      if (idCurrency === this.hardCurrency.idCurrency) {
        return this.hardCurrency;
      }
    }
    return this.localCurrency;
  }

  public cleanFormattedNumber(str: string): number {
    // Elimina espacios
    str = str.trim();
    // Elimina separador de miles (puntos)
    str = str.replace(/\./g, '');
    // Cambia la coma decimal por punto
    str = str.replace(/,/g, '.');
    // Convierte a número
    return Number(str);
  }



  async toLocalCurrencyByDate(db: SQLiteObject, hardAmount: number, date: string) {
    return this.getLocalValuebyDate(db, date).then((localValue) => {
      return (hardAmount * localValue) / this.currencyRelation;
    });
  }

  async toHardCurrencyByDate(db: SQLiteObject, localAmount: number, date: string) {
    return this.getLocalValuebyDate(db, date).then((localValue) => {
      return (localAmount * this.currencyRelation) / localValue;
    });
  }

  getLocalCurrency(): CurrencyEnterprise {
    return this.localCurrency;
  }

  getHardCurrency(): CurrencyEnterprise {
    return this.hardCurrency;
  }

  getLocalValue(): string {
    // devuelve localValue con el numero apropiado de decimales.
    return this.formatNumber(Number(this.localValue));
  }

  oppositeCoCurrency(coCurrency: string) {
    if (this.multimoneda) {
      if (coCurrency === this.localCurrency.coCurrency) {
        return this.hardCurrency.coCurrency;
      } else {
        return this.localCurrency.coCurrency;
      }
    } else {
      return "";
    }

  }

  getCurrency(coCurrency: string) {
    if (this.multimoneda) {
      if (coCurrency === this.localCurrency.coCurrency) {
        return this.localCurrency;
      } else {
        return this.hardCurrency;
      }
    } else {
      return this.localCurrency;
    }
  }

  getOppositeCurrency(coCurrency: string) {
    if (this.multimoneda) {
      if (coCurrency === this.hardCurrency.coCurrency) {
        return this.localCurrency;
      } else {
        return this.hardCurrency;
      }
    } else {
      return this.localCurrency;
    }

  }

  async getLocalValuebyDate(db: SQLiteObject, date: string) {
    //let isoDate = this.dateService.toISOString(date);
    //CABLE apestoso que probablemente tengamos que cambiar para clientes internacionales
    let isoDate = date + "T04:00:00.000+00:00";
    var selectStatement = "SELECT nu_value_local FROM conversion_types WHERE date_conversion = ? ORDER BY id_conversion_type DESC LIMIT 1";
    return db.executeSql(selectStatement, [isoDate]).then((result: any) => {
      var localValue = 0;
      if (result.rows.length > 0) {
        localValue = result.rows.item(0).nu_value_local;
      }
      return localValue;
    })
  }

  currencyTest() {
    //Para probar que todas las funciones y variables esten bien
    console.log("[CurrencyService] TESTIN");
    console.log("multicurrency: " + this.globalConfig.get("multiCurrency"));
    console.log("localCurrency:" + JSON.stringify(this.getLocalCurrency()));
    if (this.multimoneda) {
      console.log("hardCurrency:" + JSON.stringify(this.getHardCurrency()));
      console.log("currencyRelation: " + this.currencyRelation.toString());
      console.log("localValue: " + this.localValue.toString());

      console.log("100 " + this.getLocalCurrency().coCurrency + " = " + this.toHardCurrency(100).toString() + this.getHardCurrency().coCurrency);
      console.log("100 " + this.getHardCurrency().coCurrency + " = " + this.toLocalCurrency(100).toString() + this.getLocalCurrency().coCurrency);

    }


  }

  //========================= QUERIES =========================
  async queryLocalCurrency(db: SQLiteObject): Promise<void> {
    const selectStatement = "SELECT * FROM currency_enterprises WHERE local_currency = 'true'";
    const currency = await this.queryCurrency(db, selectStatement);
    if (currency) {
      this.localCurrency = currency;
      localStorage.setItem("localCurrency", this.localCurrency.coCurrency);
    }
  }

  async queryHardCurrency(db: SQLiteObject): Promise<void> {
    const selectStatement = "SELECT * FROM currency_enterprises WHERE hard_currency = 'true'";
    const currency = await this.queryCurrency(db, selectStatement);
    if (currency) {
      this.hardCurrency = currency;
      localStorage.setItem("hardCurrency", this.hardCurrency.coCurrency);
    }
  }

  async queryCurrency(db: SQLiteObject, selectStatement: string) {

    return db.executeSql(selectStatement, []).then((result: any) => {
      var currency: CurrencyEnterprise
      var c;
      if (result.rows.length > 0) {
        c = result.rows.item(0);
        currency = new CurrencyEnterprise(
          c.id_currency_enterprise,
          c.co_currency,
          c.id_currency,
          c.local_currency,
          c.hard_currency,
          c.co_enterprise,
          c.id_enterprise
        )
        return currency;
      } else {
        throw ("[CurrencyService] No llego data de moneda");
      }
    }).catch((error: any) => console.log(error))


  }

  async queryCurrencyRelation(db: SQLiteObject): Promise<void> {
    const selectStatement = "SELECT nu_exchange_rate FROM currency_relations ORDER BY id_currency_relation DESC LIMIT 1";
    const result: any = await db.executeSql(selectStatement, []);
    let relation: number | null = null;

    if (result.rows.length > 0) {
      relation = Number(result.rows.item(0).nu_exchange_rate);
    }

    if (relation != null && this.isValidExchangeFactor(relation)) {
      this.currencyRelation = relation;
      return;
    }

    console.warn("[CurrencyService] No se encontró una relación de moneda válida. Se asignará 1 por defecto.");
    this.currencyRelation = 1;
  }

  async queryLocalValue(db: SQLiteObject): Promise<void> {
    const selectStatement = "SELECT nu_value_local FROM conversion_types ORDER BY date_conversion DESC LIMIT 1";
    const result: any = await db.executeSql(selectStatement, []);
    let localValue: number | null = null;
    if (result.rows.length > 0) {
      localValue = Number(result.rows.item(0).nu_value_local);
    }

    if (localValue != null && this.isValidExchangeFactor(localValue)) {
      this.localValue = localValue;
      return;
    }

    console.warn("[CurrencyService] No se encontró nu_value_local válido. Se asignará 1 por defecto.");
    this.localValue = 1;
  }

  getCurrencyModules(db: SQLiteObject) {
    const query = "SELECT * FROM currency_modules cm JOIN modules m ON m.id_module = cm.id_module";
    return db.executeSql(query, []).then(data => {
      let map: Map<string, CurrencyModules> = new Map<string, CurrencyModules>();
      for (let i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i);
        let cm: CurrencyModules = {
          idCurrencyModules: item.id_currency_module,
          idModule: item.id_module,
          localCurrencyDefault: item.local_currency_default === null ? true : item.local_currency_default.toLowerCase() === 'true',
          showConversion: item.show_conversion === null ? true : item.show_conversion.toLowerCase() === 'true',
          currencySelector: item.currency_selector === null ? true : item.currency_selector.toLowerCase() === 'true',
        };
        map.set(item.co_module, cm);
      }
      return map;
    });
  }

}
