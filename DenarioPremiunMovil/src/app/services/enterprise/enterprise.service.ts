import { Injectable } from '@angular/core';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { Enterprise } from 'src/app/modelos/tables/enterprise';

@Injectable({
  providedIn: 'root'
})
export class EnterpriseService {
  public empresas: Enterprise[] = [] //listado de empresas. ordenado por prioridad.

  constructor(
    
  ) {

  }



  async setup(dbServ: SQLiteObject) {
    if (this.empresas.length > 0) {
      //ya hay empresas asi que no hago nada
      //console.log("[EnterpriseService] Empresas ya cargadas.");
      //console.log(this.empresas);
      return Promise.resolve();
    } else {
      //no hay empresas asi que hay que buscarlas
      var database = dbServ;
      var select = "SELECT id_enterprise as idEnterprise, co_enterprise as coEnterprise, " +
        "lb_enterprise as lbEnterprise, co_currency_default as coCurrencyDefault, " +
        "priority_selection as prioritySelection, enterprise_default as enterpriseDefault, " +
        "na_enterprise as naEnterprise, nu_rif as nuRif, tx_address as txAddress " +
        "FROM enterprises ORDER BY priority_selection ASC"
      try {
        const result_1 = await database.executeSql(select, []);
        for (let i = 0; i < result_1.rows.length; i++) {
          this.empresas.push(result_1.rows.item(i));
        }
      } catch (e) {
        this.empresas = [];
        console.log("[EnterpriseService] Error al cargar empresas.");
        console.log(e);
      }
    }
  }

  esMultiempresa() {
    //console.log("# Empresas:" + this.empresas.length);
    return (this.empresas.length > 1);
  }

  defaultEnterprise() {
    return this.empresas[0];
  }

  getEnterprises() {
    return this.empresas;
  }

  getEntepriseById(idEnterprise: number) {
    return this.empresas.find((emp: Enterprise) => emp.idEnterprise === idEnterprise)!;
  }

  initialze() {
    this.empresas = [] as Enterprise[];
  }
}
