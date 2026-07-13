import { Injectable, inject } from '@angular/core';

import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';

import { PotentialClient } from '../../../modelos/tables/potentialClient';
import { SynchronizationDBService } from '../../synchronization/synchronization-db.service';

import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

import { Subject, Observable, throwError, map } from 'rxjs';
import { Enterprise } from 'src/app/modelos/tables/enterprise';
import { PendingTransaction } from 'src/app/modelos/tables/pendingTransactions';
import { CLIENT_POTENTIAL_STATUS_TO_SEND } from 'src/app/utils/appConstants';
import { ServicesService } from '../../services.service';
import { AdjuntoService } from 'src/app/adjuntos/adjunto.service';
import { DateServiceService } from '../../dates/date-service.service';

@Injectable({
  providedIn: 'root'
})
export class PotentialClientDatabaseServicesService {
  public dbServ = inject(SynchronizationDBService);
  public url!: string;
  public services = inject(ServicesService);
  public adjuntoService = inject(AdjuntoService);
  public dateServ = inject(DateServiceService);


  public saveSend = new Subject<Boolean>; //para salvar o guardar el nuevo cliente potencial

  constructor(private http: HttpClient,
  ) {
    this.url = 'potentialclientservice/potentialclient';

  }


  getPotentialClient() {
    return this.dbServ.getDatabase().executeSql(
      'SELECT * FROM potential_clients ORDER BY co_client DESC ', [
    ]).then(res => {
      let potentialClient: PotentialClient[] = [];
      for (var i = 0; i < res.rows.length; i++) {
        potentialClient.push({
          id: res.rows.item(i).id,
          idClient: res.rows.item(i).id_client,
          coClient: res.rows.item(i).co_client,
          idUser: res.rows.item(i).id_user,
          coUser: res.rows.item(i).co_user,
          naClient: res.rows.item(i).na_client,
          nuRif: res.rows.item(i).nu_rif,
          txAddress: res.rows.item(i).tx_address,
          txAddressDispatch: res.rows.item(i).tx_address_dispatch,
          txClient: res.rows.item(i).tx_client,
          naResponsible: res.rows.item(i).na_responsible,
          emClient: res.rows.item(i).em_client,
          nuPhone: res.rows.item(i).nu_phone,
          naWebSite: res.rows.item(i).na_web_site,
          daPotentialClient: res.rows.item(i).da_potential_client,
          stPotentialClient: res.rows.item(i).st_potential_client,
          idEnterprise: res.rows.item(i).id_enterprise,
          coEnterprise: res.rows.item(i).co_enterprise,
          coordenada: res.rows.item(i).coordenada,
          coordenadaClient: res.rows.item(i).coordenada_client,
          hasAttachments: res.rows.item(i).has_attachments,
          nuAttachments: res.rows.item(i).nu_attachments,
        })
      }
      return potentialClient;

    }).catch(e => {
      let potentialClient: PotentialClient[] = [];
      console.log(e);
      return potentialClient;
    })
  }

  getPotentialClientById(coClient: string) {
    return this.dbServ.getDatabase().executeSql(
      'SELECT * FROM potential_clients WHERE co_client=?', [coClient
    ]).then(res => {
      let potentialClient: PotentialClient[] = [];
      for (var i = 0; i < res.rows.length; i++) {
        potentialClient.push({
          id: res.rows.item(i).id,
          idClient: res.rows.item(i).id_client,
          coClient: res.rows.item(i).co_client,
          idUser: res.rows.item(i).id_user,
          coUser: res.rows.item(i).co_user,
          naClient: res.rows.item(i).na_client,
          nuRif: res.rows.item(i).nu_rif,
          txAddress: res.rows.item(i).tx_address,
          txAddressDispatch: res.rows.item(i).tx_address_dispatch,
          txClient: res.rows.item(i).tx_client,
          naResponsible: res.rows.item(i).na_responsible,
          emClient: res.rows.item(i).em_client,
          nuPhone: res.rows.item(i).nu_phone,
          naWebSite: res.rows.item(i).na_web_site,
          daPotentialClient: res.rows.item(i).da_potential_client,
          stPotentialClient: res.rows.item(i).st_potential_client,
          idEnterprise: res.rows.item(i).id_enterprise,
          coEnterprise: res.rows.item(i).co_enterprise,
          coordenada: res.rows.item(i).coordenada,
          coordenadaClient: res.rows.item(i).coordenada_client,
          hasAttachments: res.rows.item(i).has_attachments,
          nuAttachments: res.rows.item(i).nu_attachments,
        })
      }
      return potentialClient;

    }).catch(e => {
      let potentialClient: PotentialClient[] = [];
      console.log(e);
      return potentialClient;
    })
  }



  deleteClientPotential(coClient: string) {
    return this.dbServ.getDatabase().executeSql(
      'DELETE FROM potential_clients WHERE co_client = ?',
      [coClient])
      .then(res => {
        console.log(res);
        return true;
      }).catch(e => {

        console.log(e);
        return false;
      })
  }
  saveSendNewPotentialCliente(data: Boolean) {
    this.saveSend.next(data);
  }


  insertPotentialClient(potencialClient: PotentialClient, coordenada: string, status: Boolean) {

    return this.adjuntoService.getQuantityAdjuntos().then(number => {
      potencialClient.nuAttachments = number;
      if (potencialClient.nuAttachments > 0)
        potencialClient.hasAttachments = true;

      let inserStatement = "INSERT OR REPLACE INTO potential_clients(" +
        'id_client,co_client,id_user,co_user,na_client,' +
        'nu_rif,tx_address,tx_address_dispatch,tx_client,na_responsible,' +
        'em_client,nu_phone,na_web_site,da_potential_client,st_potential_client,' +
        'id_enterprise,co_enterprise, coordenada,coordenada_client, nu_attachments,has_attachments' +
        ') ' +
        'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'

      //let fecha = new Date();
      potencialClient.idUser = Number(localStorage.getItem("idUser"));
      potencialClient.coUser = localStorage.getItem('coUser') || "[]";
      potencialClient.daPotentialClient = this.dateServ.hoyISOFullTime();

      if (status)
        potencialClient.stPotentialClient = CLIENT_POTENTIAL_STATUS_TO_SEND;

      return this.dbServ.getDatabase().executeSql(
        inserStatement, [
        0, potencialClient.coClient, potencialClient.idUser, potencialClient.coUser,
        potencialClient.naClient, potencialClient.nuRif, potencialClient.txAddress, potencialClient.txAddressDispatch,
        potencialClient.txClient, potencialClient.naResponsible, potencialClient.emClient, potencialClient.nuPhone,
        potencialClient.naWebSite, potencialClient.daPotentialClient, potencialClient.stPotentialClient,
        potencialClient.idEnterprise, potencialClient.coEnterprise,
        coordenada, potencialClient.coordenadaClient, potencialClient.nuAttachments, potencialClient.hasAttachments
      ]).then(res => {
        console.log("POTENTIAL CLIENT INSERT");
      }).catch(e => {
        console.log(e);
      })
    })
  }


  getEnterprises() {
    return this.dbServ.getDatabase().executeSql(
      'SELECT * FROM enterprises', [
    ]).then(res => {
      let empresas: Enterprise[] = [];
      for (var i = 0; i < res.rows.length; i++) {
        empresas.push({
          idEnterprise: res.rows.item(i).id_enterprise,
          lbEnterprise: res.rows.item(i).lb_enterprise,
          coEnterprise: res.rows.item(i).co_enterprise,
          coCurrencyDefault: res.rows.item(i).co_currency_default,
          prioritySelection: res.rows.item(i).prioritySelection,
          enterpriseDefault: res.rows.item(i).enterprise_default,
          naEnterprise: res.rows.item(i).na_enterprise ?? '',
          nuRif: res.rows.item(i).nu_rif ?? '',
          txAddress: res.rows.item(i).tx_address ?? '',
        })
      }
      return empresas;
    }).catch(e => {
      let empresas: Enterprise[] = [];
      console.log(e);
      return empresas;
    })
  }

  handleError(err: HttpErrorResponse): Observable<never> {
    return throwError(() => err);
  }

  getTransacction() {
    let pendingTransaction: PendingTransaction[] = [];
    return this.dbServ.getDatabase().executeSql(
      'SELECT * FROM pending_transactions WHERE type = "potentialClient"', [
    ]).then(res => {

      for (var i = 0; i < res.rows.length; i++) {
        pendingTransaction.push({
          coTransaction: res.rows.item(i).co_transaction,
          idTransaction: res.rows.item(i).id_transaction,
          type: res.rows.item(i).type,
        })
      }
      return pendingTransaction;
    }).catch(e => {

      console.log(e);
      return pendingTransaction;
    })
  }


  getHttpOptionsAuthorization() {
    const httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem("token")
      })
    }
    return httpOptions;

  }

}
