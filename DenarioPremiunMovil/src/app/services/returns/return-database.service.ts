import { Injectable, inject } from '@angular/core';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { Return } from 'src/app/modelos/tables/return';
import { ReturnDetail } from 'src/app/modelos/tables/ReturnDetail';
import { ProductService } from '../products/product.service';
import { Unit } from 'src/app/modelos/tables/unit';
import { Invoice } from 'src/app/modelos/tables/invoice';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';

@Injectable({
  providedIn: 'root'
})
export class ReturnDatabaseService {

  //dbServ = inject(SynchronizationDBService);
  productService = inject(ProductService);

  public invoiceDetailUnits: Unit[] = [];

  constructor() { }

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

    var retrieveStatement = "select co_return_detail as coReturnDetail, id_return as idReturn, co_return as coReturn, id_product as idProduct," +
      " co_product as coProduct, na_product as naProduct, qu_product as quProduct, id_measure_unit, co_measure_unit as coMeasureUnit, na_measure_unit as naMeasureUnit, qu_unit, " +
      "unit_co_enterprise, unit_id_enterprise, id_product_unit, co_product_unit,  " +
      " nu_lote as nuLote, da_duedate as daDueDate, co_document as coDocument, id_motive as idMotive FROM return_details where co_return = ?";
    return dbServ.executeSql(retrieveStatement, [coReturn]).then(data => {
      //console.log(data);
      let returnDetails: ReturnDetail[] = []
      for (let i = 0; i < data.rows.length; i++) {
        const item = data.rows.item(i);
        let unitProduct: Unit = {} as Unit;
        unitProduct.idUnit = data.rows.item(i).id_measure_unit;
        unitProduct.coUnit = data.rows.item(i).coMeasureUnit;
        unitProduct.naUnit = data.rows.item(i).naMeasureUnit;
        unitProduct.quUnit = data.rows.item(i).qu_unit;
        unitProduct.coEnterprise = data.rows.item(i).unit_co_enterprise;
        unitProduct.idEnterprise = data.rows.item(i).unit_id_enterprise;
        unitProduct.idProductUnit = data.rows.item(i).id_product_unit;
        unitProduct.coProductUnit = data.rows.item(i).co_product_unit;
        item.unit = unitProduct;
        item.idUnit = data.rows.item(i).id_measure_unit;
        item.productUnits = this.getUnitsByIdProductOrderByCoPrimaryUnit(dbServ, item.idProduct);
        item.showDateModal = false;
        returnDetails.push(item);
      }
      return returnDetails;
    }).catch(e => {
      console.log("[ReturnDatabaseService] Error al ejecutar getDetailsByCoReturn.");
      console.log(e);
      return [];
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
            detail.unit?.idUnit,
            detail.coMeasureUnit,
            detail.naMeasureUnit,
            detail.unit?.quUnit,
            devolucion.coEnterprise,
            devolucion.idEnterprise,
            detail.unit?.idProductUnit,
            detail.unit?.coProductUnit,
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

  getUnitsByIdProductOrderByCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number) {
    let unitsByProduct: Unit[] = [];
    this.getUnitByIdProductAndCoPrimaryUnit(dbServ, idProduct).then(listPrimary => {
      this.getUnitByIdProductAndNotCoPrimaryUnit(dbServ, idProduct).then(listOther => {
        unitsByProduct.push(...listOther!);
      });
      unitsByProduct.push(...listPrimary!);
    })
    return unitsByProduct;
  }

  getUnitByIdProductAndCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number) {
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
      console.log("[ProductService] Error al cargar getUnitByIdProductAndCoPrimaryUnit.");
      console.log(e);
    })
  }

  getUnitByIdProductAndNotCoPrimaryUnit(dbServ: SQLiteObject, idProduct: number) {
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
      console.log("[ProductService] Error al cargar getUnitByIdProductAndNotCoPrimaryUnit.");
      console.log(e);
    })
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
