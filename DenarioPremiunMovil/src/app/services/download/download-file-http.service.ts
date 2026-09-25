import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ServicesService } from '../services.service';

@Injectable({
  providedIn: 'root',
})
export class DownloadFileHttpService {
  constructor(
    private readonly http: HttpClient,
    private readonly services: ServicesService,
  ) {}

  downloadDispatchFile(nameFile: string): Observable<ArrayBuffer> {
    const url = this.services.buildDispatchFileDownloadUrl(nameFile);
    return this.http.get(url, { responseType: 'arraybuffer' });
  }
}
