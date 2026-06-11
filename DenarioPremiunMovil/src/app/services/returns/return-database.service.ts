import { Injectable, inject } from '@angular/core';
import { Return } from 'src/app/modelos/tables/return';
import { ReturnDetail } from 'src/app/modelos/tables/ReturnDetail';
import { ProductService } from '../products/product.service';
import { Unit } from 'src/app/modelos/tables/unit';
import { Invoice } from 'src/app/modelos/tables/invoice';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { DateServiceService } from '../dates/date-service.service';

@Injectable({
  providedIn: 'root'
})
export class ReturnDatabaseService {

  productService = inject(ProductService);
  private dateServ = inject(DateServiceService);

  public invoiceDetailUnits: Unit[] = [];

  constructor() { }

  /**
   * Antes de aplicar sync, conserva da_return local en devoluciones ya registradas en el dispositivo
   * y normaliza las fechas entrantes del servidor a YYYY-MM-DD HH:mm:ss (hora local).
   */
  mergeSyncedReturnsWithLocalDates(dbServ: SQLiteObject, returns: Return[]): Promise<Return[]> {
    if (!Array.isArray(returns) || returns.length === 0) {
      return Promise.resolve(returns);
    }

    const coReturns = returns
      .map(item => item?.coReturn)
      .filter((coReturn): coReturn is string => !!coReturn?.trim());

    if (coReturns.length === 0) {
      return Promise.resolve(this.normalizeSyncedReturnDates(returns));
    }

    const placeholders = coReturns.map(() => '?').join(',');
    const selectStatement = `SELECT co_return, da_return, st_delivery FROM returns WHERE co_return IN (${placeholders})`;

    return dbServ.executeSql(selectStatement, coReturns).then(result => {
      const localByCoReturn = new Map<string, { daReturn: string; stDelivery: number }>();

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        localByCoReturn.set(String(row.co_return), {
          daReturn: row.da_return ?? '',
          stDelivery: Number(row.st_delivery ?? 0),
        });
      }

      return returns.map(syncedReturn => {
        const localReturn = localByCoReturn.get(syncedReturn.coReturn);
        const localDaReturn = (localReturn?.daReturn ?? '').trim();

        if (localReturn && localDaReturn.length > 0) {
          syncedReturn.daReturn = this.dateServ.toDbDateTime(localReturn.daReturn);
          return syncedReturn;
        }

        syncedReturn.daReturn = this.dateServ.toDbDateTime(syncedReturn.daReturn);
        return syncedReturn;
      });
    }).catch(error => {
      console.log('[ReturnDatabaseService] mergeSyncedReturnsWithLocalDates error', error);
      return this.normalizeSyncedReturnDates(returns);
    });
  }

  private normalizeSyncedReturnDates(returns: Return[]): Return[] {
    return returns.map(syncedReturn => {
      syncedReturn.daReturn = this.dateServ.toDbDateTime(syncedReturn.daReturn);
      return syncedReturn;
    });
  }

  // BUSCO LA DEVOLUCION PASANDO EL CO_RETURN
  getReturn(dbServ: SQLiteObject, coReturn: string) {
    var devol: Return;
    var retrieveStatement = "SELECT id_return as idReturn, co_return as coReturn, " +
      "st_return as stReturn, da_return as daReturn, " +
      "na_responsible as naResponsible, nu_seal as nuSeal, id_type as idType, tx_comment as txComment, " +
      "co_user as coUser, id_user as idUser, co_client as coClient, id_client as idClient, lb_client as lbClient, " +
      "co_invoice as coInvoice, id_invoice as idInvoice, coordenada, " +
      "co_enterprise as coEnterprise, id_enterprise as idEnterprise, nu_attachments as nuAttachments, has_attachments as hasAttachments, st_delivery as stDelivery  " +
      "FROM returns WHERE co_return = ?"
    return dbServ.executeSql(retrieveStatement, [coReturn]).then(result => {
      devol = result.rows.item(0);
      console.log(devol);
      return this.getDetailsByCoReturn(dbServ, devol.coReturn).then(details => {
        devol.details = details;
        return devol;
      })
    }).catch(e => {
      console.log("[ReturnDatabaseService] Error al ejecutar getReturn.");
      console.log(e);
      return devol;
    });
  }

  // AHORA BUSCO LOS DETALLES PASANDO EL CO_RETURN
  getDetailsByCoReturn(dbServ: SQLiteObject, coReturn: string) {
    const retrieveStatement = 'select co_return_detail as coReturnDetail, id_return as idReturn, co_return as coReturn, id_product as idProduct,' +
      ' co_product as coProduct, na_product as naProduct, qu_product as quProduct, id_measure_unit, co_measure_unit as coMeasureUnit, na_measure_unit as naMeasureUnit, qu_unit, ' +
      'unit_co_enterprise, unit_id_enterprise, id_product_unit, co_product_unit,  ' +
      ' nu_lote as nuLote, da_duedate as daDueDate, co_document as coDocument, id_motive as idMotive FROM return_details where co_return = ?';

    return dbServ.executeSql(retrieveStatement, [coReturn]).then(async data => {
      const returnDetails: ReturnDetail[] = [];

      for (let i = 0; i < data.rows.length; i++) {
        const row = data.rows.item(i);
        const detail = await this.buildReturnDetailFromRow(dbServ, row);
        returnDetails.push(detail);
      }

      return returnDetails;
    }).catch(e => {
      console.log('[ReturnDatabaseService] Error al ejecutar getDetailsByCoReturn.');
      console.log(e);
      return [];
    });
  }

  private async buildReturnDetailFromRow(dbServ: SQLiteObject, row: any): Promise<ReturnDetail> {
    const savedUnit = this.buildSavedUnitFromDetailRow(row);
    const idProduct = Number(this.getRowField(row, 'idProduct', 'id_product') ?? 0);
    const loadedUnits = idProduct > 0
      ? await this.loadUnitsByIdProductOrderByCoPrimaryUnit(dbServ, idProduct)
      : [];
    const productUnits = this.mergeProductUnits(loadedUnits, savedUnit);
    const idUnit = Number(savedUnit.idUnit ?? 0);
    const selectedUnit = productUnits.find(unit => this.isSameUnitId(unit.idUnit, idUnit))
      ?? productUnits[0]
      ?? savedUnit;

    return {
      coReturnDetail: String(this.getRowField(row, 'coReturnDetail', 'co_return_detail') ?? ''),
      idReturn: this.getRowField(row, 'idReturn', 'id_return') ?? null,
      coReturn: String(this.getRowField(row, 'coReturn', 'co_return') ?? ''),
      idProduct,
      coProduct: String(this.getRowField(row, 'coProduct', 'co_product') ?? ''),
      naProduct: String(this.getRowField(row, 'naProduct', 'na_product') ?? ''),
      quProduct: Number(this.getRowField(row, 'quProduct', 'qu_product') ?? 0),
      coMeasureUnit: selectedUnit?.coUnit ?? '',
      naMeasureUnit: selectedUnit?.naUnit ?? '',
      idUnit: Number(selectedUnit?.idUnit ?? idUnit),
      unit: selectedUnit,
      productUnits,
      validateProductUnits: [],
      nuLote: String(this.getRowField(row, 'nuLote', 'nu_lote') ?? ''),
      daDueDate: this.getRowField(row, 'daDueDate', 'da_duedate') ?? null,
      coDocument: String(this.getRowField(row, 'coDocument', 'co_document') ?? ''),
      idMotive: Number(this.getRowField(row, 'idMotive', 'id_motive') ?? 0),
      showDateModal: false,
    } as ReturnDetail;
  }

  private getRowField(row: Record<string, unknown>, ...keys: string[]): unknown {
    for (const key of keys) {
      const value = row?.[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return undefined;
  }

  private buildSavedUnitFromDetailRow(row: any): Unit {
    return {
      idUnit: Number(this.getRowField(row, 'id_measure_unit', 'idMeasureUnit', 'idUnit') ?? 0),
      coUnit: String(this.getRowField(row, 'coMeasureUnit', 'co_measure_unit', 'coUnit') ?? ''),
      naUnit: String(this.getRowField(row, 'naMeasureUnit', 'na_measure_unit', 'naUnit') ?? ''),
      quUnit: Number(this.getRowField(row, 'qu_unit', 'quUnit') ?? 0),
      coEnterprise: String(this.getRowField(row, 'unit_co_enterprise', 'unitCoEnterprise') ?? ''),
      idEnterprise: Number(this.getRowField(row, 'unit_id_enterprise', 'unitIdEnterprise') ?? 0),
      idProductUnit: Number(this.getRowField(row, 'id_product_unit', 'idProductUnit') ?? 0),
      coProductUnit: String(this.getRowField(row, 'co_product_unit', 'coProductUnit') ?? ''),
    } as Unit;
  }

  private hasSavedUnitData(savedUnit: Unit | undefined): boolean {
    if (!savedUnit) {
      return false;
    }

    return Number(savedUnit.idUnit ?? 0) > 0
      || !!String(savedUnit.naUnit ?? '').trim()
      || !!String(savedUnit.coUnit ?? '').trim();
  }

  private isSameUnitId(first: unknown, second: unknown): boolean {
    return Number(first ?? 0) === Number(second ?? 0) && Number(first ?? 0) > 0;
  }

  private mergeProductUnits(loadedUnits: Unit[], savedUnit: Unit): Unit[] {
    const merged = [...(loadedUnits ?? [])];

    if (!this.hasSavedUnitData(savedUnit)) {
      return merged;
    }

    const savedExists = merged.some(unit =>
      this.isSameUnitId(unit.idUnit, savedUnit.idUnit)
      || (!!savedUnit.coUnit && unit.coUnit === savedUnit.coUnit)
    );

    if (!savedExists) {
      merged.unshift(savedUnit);
    }

    return merged.length > 0 ? merged : [savedUnit];
  }

  loadUnitsByIdProductOrderByCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number): Promise<Unit[]> {
    return Promise.all([
      this.getUnitByIdProductAndCoPrimaryUnit(dbServ, idProduct),
      this.getUnitByIdProductAndNotCoPrimaryUnit(dbServ, idProduct),
    ]).then(([primaryUnits, otherUnits]) => {
      return [...(otherUnits ?? []), ...(primaryUnits ?? [])];
    });
  }

  saveReturn(dbServ: SQLiteObject, newReturn: Return) {
    var insertStatement: string;
    var params = []

    insertStatement = "INSERT OR REPLACE INTO returns(" +
      "id_return, co_return, st_return, da_return, na_responsible, nu_seal, id_type," +
      " tx_comment, co_user, id_user, co_client, id_client, lb_client, co_invoice, id_invoice, coordenada, co_enterprise, id_enterprise, nu_attachments, has_attachments, st_delivery) " +
      "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    params = [newReturn.idReturn, newReturn.coReturn, newReturn.stReturn, newReturn.daReturn, this.cleanString(newReturn.naResponsible), this.cleanString(newReturn.nuSeal), newReturn.idType,
    this.cleanString(newReturn.txComment), newReturn.coUser, newReturn.idUser, newReturn.coClient, newReturn.idClient, newReturn.lbClient, newReturn.coInvoice, newReturn.idInvoice,
    newReturn.coordenada, newReturn.coEnterprise, newReturn.idEnterprise, newReturn.nuAttachments, newReturn.hasAttachments, newReturn.stDelivery];
    return dbServ.executeSql(insertStatement, params).then(
      () => {
        console.log("[ReturnDatabaseService] saveReturn exitoso");
      }).catch(e => {
        console.log("[ReturnDatabaseService] Error al ejecutar saveReturn.");
        console.log(e);
      });
  }

  deleteReturnsBatch(dbServ: SQLiteObject, returns: Return[]) {
    let queries: any[] = [];
    const deleteStatement = "DELETE FROM returns WHERE co_return = ?";
    const deleteDetailsStatement = "DELETE FROM return_details WHERE co_return = ?";

    for (let i = 0; i < returns.length; i++) {
      let coReturn = returns[i].coReturn;
      queries.push([deleteDetailsStatement, [coReturn]]);
      queries.push([deleteStatement, [coReturn]]);
    }
    return dbServ.sqlBatch(queries).then(() => {
      console.log("[ReturnDatabaseService] deleteReturnsBatch exitoso");
    }).catch(error => {
      console.log("[ReturnDatabaseService] Error al ejecutar deleteReturnsBatch.");
      console.log(error);
    });
  }


  saveReturnBatch(dbServ: SQLiteObject, returns: Return[]) {
    let queries: any[] = [];

    const insertStatement = "INSERT OR REPLACE INTO returns(" +
      "id_return, co_return, st_return, da_return, na_responsible, nu_seal, id_type, " +
      "tx_comment, co_user, id_user, co_client, id_client, lb_client, co_invoice, id_invoice, " +
      "coordenada, co_enterprise, id_enterprise, nu_attachments, has_attachments, st_delivery) " +
      "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

    const insertStatementDetails = "INSERT OR REPLACE INTO return_details(id_return, co_return, co_return_detail, id_product, co_product, na_product, qu_product, id_measure_unit, co_measure_unit, na_measure_unit, qu_unit, unit_co_enterprise, unit_id_enterprise, id_product_unit, co_product_unit, nu_lote, da_duedate, co_document, id_motive) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";


    for (let re = 0; re < returns.length; re++) {
      const devolucion = returns[re];

      // Validación: si coUser es null/undefined/vacío, asigna un valor por defecto o lanza error
      if (!devolucion.coUser) {
        devolucion.coUser = '0'; // o cualquier valor por defecto que desees
      }

      queries.push([
        insertStatement,
        [
          devolucion.idReturn,
          devolucion.coReturn,
          devolucion.stReturn,
          devolucion.daReturn,
          devolucion.naResponsible,
          devolucion.nuSeal,
          devolucion.idType,
          devolucion.txComment,
          devolucion.coUser,
          devolucion.idUser,
          devolucion.coClient,
          devolucion.idClient,
          devolucion.naClient,
          devolucion.coInvoice,
          devolucion.idInvoice,
          devolucion.coordenada,
          devolucion.coEnterprise,
          devolucion.idEnterprise,
          devolucion.nuAttachments,
          devolucion.hasAttachments,
          devolucion.stDelivery
        ]
      ]);

      for (let i = 0; i < devolucion.details.length; i++) {
        const detail = devolucion.details[i];
        detail.coReturnDetail = devolucion.coReturn + '-' + (i + 1);
        queries.push([
          insertStatementDetails,
          [
            devolucion.idReturn,
            devolucion.coReturn,
            detail.coReturnDetail,
            detail.idProduct,
            detail.coProduct,
            detail.naProduct,
            detail.quProduct,
            detail.unit?.idUnit ?? detail.idUnit,
            detail.unit?.coUnit ?? detail.coMeasureUnit ?? '',
            detail.unit?.naUnit ?? detail.naMeasureUnit ?? '',
            detail.unit?.quUnit ?? 0,
            detail.unit?.coEnterprise ?? devolucion.coEnterprise,
            detail.unit?.idEnterprise ?? devolucion.idEnterprise,
            detail.unit?.idProductUnit ?? 0,
            detail.unit?.coProductUnit ?? '',
            this.cleanString(detail.nuLote),
            detail.daDueDate,
            this.cleanString(detail.coDocument),
            detail.idMotive
          ]
        ]);
      }
    }
    return dbServ.sqlBatch(queries).then(() => { }).catch(error => { });
  }

  cleanString(str: string): string {
    if (!str) {
      return '';
    }
    // Elimina espacios al principio y al final
    str = str.trim();
    // Elimina ;
    str = str.replace(/;/g, '');
    // Elimina comillas simples
    str = str.replace(/'/g, '');
    // Elimina comillas dobles
    str = str.replace(/"/g, '');


    return str;
  }

  saveReturnDetails(dbServ: SQLiteObject, details: ReturnDetail[]) {
    var insertStatement: string = '';
    var batch = [];
    for (let i = 0; i < details.length; i++) {
      let params = [];
      insertStatement = "INSERT or replace INTO return_details(co_return, co_return_detail, id_product, co_product, na_product, qu_product, id_measure_unit, co_measure_unit, na_measure_unit, qu_unit, unit_co_enterprise, unit_id_enterprise, id_product_unit, co_product_unit, nu_lote, da_duedate, co_document, id_motive) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
      params = [details[i].coReturn, details[i].coReturnDetail, details[i].idProduct, details[i].coProduct,
      details[i].naProduct, details[i].quProduct, details[i].unit?.idUnit, details[i].unit?.coUnit, details[i].unit?.naUnit, details[i].unit?.quUnit, details[i].unit?.coEnterprise,
      details[i].unit?.idEnterprise, details[i].unit?.idProductUnit, details[i].unit?.coProductUnit,
      this.cleanString(details[i].nuLote), details[i].daDueDate, this.cleanString(details[i].coDocument), details[i].idMotive]

      var q = [insertStatement, params];
      batch.push(q);
    }
    return dbServ.sqlBatch(batch).then(() => {
      /* return this.getIncidencesByVisit(input[0].idVisit); */
      console.log("[ReturnDatabaseService] saveReturnDetails exitoso");
    }).catch(e => {
      console.log("[ReturnDatabaseService] Error al ejecutar saveReturnDetails.");
      console.log(e);
    });
  }

  deleteReturnDetails(dbServ: SQLiteObject, coReturn: string) {
    var deleteStatement = "DELETE FROM return_details  WHERE co_return = ?";
    return dbServ.executeSql(deleteStatement, [coReturn]).then(result => {
      console.log('[Devolucion] Borrando detalles: ' + coReturn);
      console.log(result)
    })
  }

  deleteReturn(dbServ: SQLiteObject, coReturn: string) {
    var deleteStatement = "DELETE from returns where co_return = ?"
    return dbServ.executeSql(deleteStatement, [coReturn]).then(result => {
      console.log('[Devolucion] Borrando return: ' + coReturn);
      console.log(result)
    })
  }

  getUnitsByIdProductOrderByCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number): Promise<Unit[]> {
    return this.loadUnitsByIdProductOrderByCoPrimaryUnit(dbServ, idProduct);
  }

  getUnitByIdProductAndCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number): Promise<Unit[]> {
    var database = dbServ;

    var select = "select u.id_unit, u.co_unit, u.na_unit, u.id_enterprise, u.co_enterprise, pu.id_product_unit, pu.co_product_unit, pu.qu_unit  from units u join product_units pu on u.id_unit = pu.id_unit join products p on pu.id_product = p.id_product where pu.id_product = ? and u.co_unit = p.co_primary_unit"
    return database.executeSql(select, [idProduct]).then(result => {
      let unitsByProduct: Unit[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        unitsByProduct.push({
          idUnit: result.rows.item(i).id_unit,
          coUnit: result.rows.item(i).co_unit,
          naUnit: result.rows.item(i).na_unit,
          idEnterprise: result.rows.item(i).id_enterprise,
          coEnterprise: result.rows.item(i).co_enterprise,
          idProductUnit: result.rows.item(i).id_product_unit,
          coProductUnit: result.rows.item(i).co_product_unit,
          quUnit: result.rows.item(i).qu_unit,
        });
      }
      return unitsByProduct;
    }).catch(e => {
      console.log('[ReturnDatabaseService] Error al cargar getUnitByIdProductAndCoPrimaryUnit.');
      console.log(e);
      return [] as Unit[];
    });
  }

  getUnitByIdProductAndNotCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number): Promise<Unit[]> {
    var database = dbServ;

    var select = "select u.id_unit, u.co_unit, u.na_unit, u.id_enterprise, u.co_enterprise, pu.id_product_unit, pu.co_product_unit, pu.qu_unit from units u join product_units pu on u.id_unit = pu.id_unit join products p on pu.id_product = p.id_product where pu.id_product = ? and u.co_unit != p.co_primary_unit"
    return database.executeSql(select, [idProduct]).then(result => {
      let unitsByProduct: Unit[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        unitsByProduct.push({
          idUnit: result.rows.item(i).id_unit,
          coUnit: result.rows.item(i).co_unit,
          naUnit: result.rows.item(i).na_unit,
          idEnterprise: result.rows.item(i).id_enterprise,
          coEnterprise: result.rows.item(i).co_enterprise,
          idProductUnit: result.rows.item(i).id_product_unit,
          coProductUnit: result.rows.item(i).co_product_unit,
          quUnit: result.rows.item(i).qu_unit,
        });
      }
      return unitsByProduct;
    }).catch(e => {
      console.log('[ReturnDatabaseService] Error al cargar getUnitByIdProductAndNotCoPrimaryUnit.');
      console.log(e);
      return [] as Unit[];
    });
  }

  // BUSCO LAS FACTURAS ASOCIADAS A UN CLIENTE
  getInvoicesByIdClient(dbServ: SQLiteObject, idClient: number) {
    var retrieveStatement = "select co_invoice as coInvoice, id_invoice as idInvoice, da_invoice as daInvoice " +
      " FROM invoices where id_client = ?";
    return dbServ.executeSql(retrieveStatement, [idClient]).then(data => {
      //console.log(data);
      let invoices: Invoice[] = []
      for (let i = 0; i < data.rows.length; i++) {
        invoices.push(data.rows.item(i));
      }
      return invoices;
    }).catch(e => {
      console.log("[ReturnDatabaseService] Error al ejecutar getInvoicesByIdClient.");
      console.log(e);
      return [];
    });
  }

  getInvoiceDetailUnitsByIdInvoice(dbServ: SQLiteObject, idnvoice: number) {
    var database = dbServ;
    this.invoiceDetailUnits = [];
    var select = "select idu.id_enterprise as idEnterprise, idu.co_enterprise as coEnterprise, idu.id_product_unit as idProductUnit, idu.co_product_unit as coProductUnit, idu.qu_invoice as quUnit from invoice_detail_units idu where idu.id_invoice_detail in (select id.id_invoice_detail from invoice_details id where id.id_invoice = ?)"
    return database.executeSql(select, [idnvoice]).then(result => {
      for (let i = 0; i < result.rows.length; i++) {
        this.invoiceDetailUnits.push(result.rows.item(i));
      }
    }).catch(e => {
      this.invoiceDetailUnits = [];
      console.log("[ReturnDatabaseService] Error al cargar getInvoiceDetailUnitsByIdInvoice.");
      console.log(e);
    })
  }


}
