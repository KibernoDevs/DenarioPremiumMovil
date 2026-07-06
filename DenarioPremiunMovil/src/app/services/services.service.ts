import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CapacitorHttp, HttpOptions, HttpResponse, HttpHeaders } from '@capacitor/core';
import { catchError, map, tap } from 'rxjs/operators';
import { from, throwError, firstValueFrom } from 'rxjs';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { User } from '../modelos/user';
import { Login } from '../modelos/login';
import { syncResponse } from '../modelos/tables/getSyncResponse';
import { ApplicationTags } from '../modelos/tables/applicationTags';
import { PendingTransaction } from '../modelos/tables/pendingTransactions';
export interface UploadImageResponse {
  errorCode: string;
  errorMessage?: string;
  name?: string;
  transaction?: string;
  type?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ServicesService {
  private WsUrl = "";

  private name = "";
  private last = "";
  public tags = new Map<string, string>([]);

  constructor(private http: HttpClient) {
    this.WsUrl = this.getWsUrl();
  }

  private getWsUrl(): string {
    const env = (window as Window & { __env?: Record<string, string> }).__env || {};
    return env["WsUrl"];
  }

  getURLService() {
    return this.WsUrl || this.getWsUrl();
  }

  handleError(error: HttpErrorResponse) {
    if (error.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error.message);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(
        `Backend returned code ${error.status}, ` +
        `body was: ${JSON.stringify(error.error)}`);
    }
    // Return an observable with a user-facing error message.
    return throwError(
      'Something bad happened; please try again later.');
  }


  // Http Options
  getHttpOptions() {
    const httpOptions = {
      url: this.WsUrl || this.getWsUrl(),
      headers: {
        'Content-Type': 'application/json',
      }
    } as HttpOptions;
    return httpOptions;
  }

  getHttpOptionsAuthorization() {
    const httpOptions = {
      url: this.WsUrl || this.getWsUrl(),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem("token")
      }
    } as HttpOptions;
    return httpOptions;

  }

  async onLogin(_login: Login, deviceInfo: any, deviceId: any,) {
    if (localStorage.getItem("lastUpdate") == null)
      localStorage.setItem("lastUpdate", "2000-01-01 00:00:00.000");

    var opt: HttpOptions;
    opt = this.getHttpOptions();
    opt.url += "authservice/auth";
    opt.data = {
      "login": _login.login.trim(),
      "password": _login.password,
      "lastLogin": localStorage.getItem("lastUpdate"),
      "dispositivo": {
        "deviceUUID": deviceId.identifier,
        "devicePlatform": deviceInfo.platform,
        "deviceModel": deviceInfo.model,
        "deviceVersion": deviceInfo.name,
        "appVersion": localStorage.getItem("versionApp")
      }
    };

    try {
      return await CapacitorHttp.post(opt)
    } catch (error) {
      console.error(error);
      catchError(this.handleError);
      throw error;

    }

  }

  getSync(tables: string) {
    let opt = this.getHttpOptionsAuthorization();
    opt.url += "syncservice/getsync";
    opt.data = JSON.parse(tables) as syncResponse;
    return from(CapacitorHttp.post(opt))
      .pipe(
        map(resp => {
          return resp
        })
      );
  }


  async getTags(database: SQLiteObject, nameModule: string, coLanguage: string) {
    return database.executeSql(
      'SELECT * FROM application_tags WHERE co_module = ? AND co_language = ?;',
      [
        nameModule, coLanguage
      ]
    ).then(res => {
      let tags: ApplicationTags[] = [];
      for (var i = 0; i < res.rows.length; i++) {
        tags.push({
          idApplicationTag: res.rows.item(i).id_application_tag,
          coApplicationTag: res.rows.item(i).co_application_tag,
          coLanguage: res.rows.item(i).co_language,
          coModule: res.rows.item(i).co_module,
          naModule: res.rows.item(i).na_module,
          tag: res.rows.item(i).tag
        })
      }
      return tags;
    }).catch(e => {
      let tags: ApplicationTags[] = [];
      console.log(e);
      return tags;
    })
  }

  insertPendingTransaction(database: SQLiteObject, pendingTransaction: PendingTransaction) {
    return database.executeSql(
      'INSERT INTO pending_transactions(co_transaction, id_transaction, type) VALUES(?,?,?);',
      [pendingTransaction.coTransaction, pendingTransaction.idTransaction, pendingTransaction.type]
    ).then(res => {
      return true;
    }).catch(e => {
      return false;
    })
  }

  insertPendingTransactionBatch(database: SQLiteObject, pendingTransactions: PendingTransaction[]) {
    var insert = 'INSERT INTO pending_transactions(co_transaction, id_transaction, type) VALUES(?,?,?);';
    var bat = []
    // console.log("insertando batch de transacciones")
    // console.log(pendingTransactions);
    for (let i = 0; i < pendingTransactions.length; i++) {
      bat.push([insert, [pendingTransactions[i].coTransaction,
      pendingTransactions[i].idTransaction, pendingTransactions[i].type]]);
    }
    return database.sqlBatch(bat).then(res => {
      return true;
    }).catch(e => {
      console.error(e);
      return false;
    });
  }

  getUserInformation() {
    let opt = this.getHttpOptionsAuthorization();
    opt.url += "userservice/userinformation";
    opt.data = {
      "idUser": localStorage.getItem("idUser")
    };

    return CapacitorHttp.post(opt)
      .catch(
        catchError(this.handleError)
      );
  }


  resolveMimeTypeFromFilename(filename: string, attachmentType?: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      default:
        if (attachmentType === 'file') {
          return 'application/octet-stream';
        }
        return 'image/jpeg';
    }
  }

  async sendImage(
    transaction: string,
    id: string,
    posicion: string,
    file: string,
    filename: string,
    type: string,
    cantidad: number,
    mimeType?: string,
  ): Promise<UploadImageResponse> {
    const httpOptions = this.getHttpOptionsAuthorization();
    const resolvedMime = mimeType || this.resolveMimeTypeFromFilename(filename, type);
    const normalizedFile = file.includes('base64,') ? file.split('base64,').pop() ?? file : file;

    const fetched = await fetch(`data:${resolvedMime};base64,${normalizedFile}`);
    const blob = await fetched.blob();

    const data = new FormData();
    data.append('transaction', transaction);
    data.append('id', id);
    data.append('posicion', posicion);
    data.append('file', blob, filename);
    data.append('type', type);
    data.append('cantidad', cantidad.toString());

    const baseUrl = httpOptions.url.endsWith('/') ? httpOptions.url : `${httpOptions.url}/`;
    const url = `${baseUrl}uploadimages`;
    const headers: Record<string, string> = {};
    if (httpOptions.headers && (httpOptions.headers as { Authorization?: string }).Authorization) {
      headers['Authorization'] = (httpOptions.headers as { Authorization: string }).Authorization;
    }

    const response = await fetch(url, {
      method: 'POST',
      body: data,
      headers,
    });
    const text = await response.text();
    let body: UploadImageResponse | string;
    try {
      body = JSON.parse(text) as UploadImageResponse;
    } catch {
      body = text;
    }

    console.log('[ServiceService] Respuesta de server:', response.status, body);

    if (!response.ok) {
      const message = typeof body === 'string'
        ? body
        : body.errorMessage ?? `Error HTTP ${response.status} al subir adjunto`;
      throw new Error(message);
    }

    if (typeof body === 'string' || String(body.errorCode ?? '') !== '000') {
      const message = typeof body === 'string'
        ? body
        : body.errorMessage ?? 'El servidor rechazó el adjunto';
      throw new Error(message);
    }

    return body;
  }

  getTagsHome() {
    return this.tags;
  }

  setTagsHome(tagsHome: Map<string, string>) {
    this.tags = tagsHome;
  }

}
