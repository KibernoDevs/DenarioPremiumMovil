import { ChangeDetectorRef, Injectable, inject } from '@angular/core';
import { ServicesService } from '../services.service';
import { HttpClient } from '@angular/common/http';
import { catchError, map, tap } from 'rxjs/operators';
import { Imagenes, ResponseFiles, ResponseImages } from 'src/app/modelos/imagenes';
import { Directory, DownloadFileResult, Filesystem } from '@capacitor/filesystem';
import { SynchronizationDBService } from '../synchronization/synchronization-db.service';
import { DateServiceService } from '../dates/date-service.service';
import { from, Subject, Subscription } from 'rxjs';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { CapacitorHttp, HttpOptions, HttpResponse, HttpHeaders } from '@capacitor/core';


@Injectable({
  providedIn: 'root'
})
export class ImageServicesService {

  private services = inject(ServicesService);
  public dateServ = inject(DateServiceService);
  public downloadFileList: string[] = [];
  public removeFileList: string[] = [];
  public downloadFileListPdf: string[] = [];
  public removeFileListPdf: string[] = [];
  public downloadFileListLogos: string[] = [];
  public removeFileListLogos: string[] = [];
  public fechaCreacion: string = "2000-01-01 00:00:00";
  private allFileList: Imagenes[] = [];
  private listFilesImages: string[] = [];
  private listFilesPdf: string[] = [];
  private listFilesLogos: string[] = [];

  public mapImages: Map<string, string[]> = new Map<string, string[]>();
  public mapImagesFiles: Map<string, string[]> = new Map<string, string[]>();
  public mapPdfFiles: Map<string, string[]> = new Map<string, string[]>();
  public mapLogos: Map<string, string> = new Map<string, string>();
  public mapLogosByFilename: Map<string, string> = new Map<string, string>();
  public imageLoaded$ = new Subject<{ imgName: string, imgSrc: string }>();

  public pendingLoads: Map<string, Promise<string>> = new Map(); // evita duplicados
  private imageSubjects: Map<string, BehaviorSubject<string | null>> = new Map(); // por imgName
  public mapImagesFilesByFilename: Map<string, string> = new Map(); // caché en memoria filename -> base64

  constructor(
    private http: HttpClient,
  ) { }

  async getServerPdfList() {
    if (localStorage.getItem("lastLoginPdf") == null)
      localStorage.setItem("lastLoginPdf", "2000-01-01 00:00:00.000");

    if (localStorage.getItem("listFilesPdf") != null)
      this.listFilesPdf = JSON.parse(localStorage.getItem("listFilesPdf")!)

    this.mapPdfFiles = new Map(JSON.parse(localStorage.getItem("mapPdfFiles")!));

    let opt = this.services.getHttpOptionsAuthorization();
    opt.url = this.services.getURLService() + "listfilespremiumdispatch";
    opt.data = {
      type: 'files',
      coUser: localStorage.getItem("coUser")!,
      naFiles: this.listFilesPdf
    }

    return from(CapacitorHttp.post(opt))
      .pipe(
        map(resp => {
          if (resp.data.errorCode == "000") {

            this.downloadFileListPdf = resp.data.downloadFileListDispatch;
            this.removeFileListPdf = resp.data.removeFileListDispatch;
            if (this.removeFileListPdf.length > 0)
              this.deleteImages(this.removeFileListPdf);
            return resp
          } else
            return "";
        })
      );
  }

  async getServerImageList() {
    if (localStorage.getItem("lastLoginImage") == null)
      localStorage.setItem("lastLoginImage", "2000-01-01 00:00:00.000");

    if (localStorage.getItem("listFilesImages") != null)
      this.listFilesImages = JSON.parse(localStorage.getItem("listFilesImages")!)

    this.mapImagesFiles = new Map(JSON.parse(localStorage.getItem("mapImagesFiles")!));

    let opt = this.services.getHttpOptionsAuthorization();
    opt.url = this.services.getURLService() + "listfilespremium";
    opt.data ={
      type: 'productos',
      naImages: this.listFilesImages
    }

    return from(CapacitorHttp.post(opt))
      .pipe(
        map(resp => {
          if (resp.data.errorCode == "000") {
            for (let i = 0; i < resp.data.downloadFileList.length; i++) {
              if (resp.data.downloadFileList[i].split(".")[1] == "db" || resp.data.downloadFileList[i].split(".")[1] == "ini") {
                resp.data.downloadFileList.splice(i, 1);
                i--;
              }
            }

            for (var i = 0; i < resp.data.removeFileList.length; i++) {
              if (resp.data.removeFileList[i].split(".")[1] == "db" || resp.data.removeFileList[i].split(".")[1] == "ini") {
                resp.data.removeFileList.splice(i, 1);
                i--;
              }
            }

            this.downloadFileList = resp.data.downloadFileList;
            this.removeFileList = resp.data.removeFileList;
            if (this.removeFileList.length > 0)
              this.deleteImages(this.removeFileList);

            return resp
          } else
            return "";
        })
      );
  }

  async downloadPdfFilesWithConcurrency(concurrency: number = 3) {
    if (!this.downloadFileListPdf || this.downloadFileListPdf.length === 0) {
      return;
    }

    const queue = [...this.downloadFileListPdf];
    const running: Promise<void>[] = [];

    const worker = async (pdfName: string) => {
      let url = "";
      try {
        url = this.services.getURLService() + "download/files?type=files&coUser=" + localStorage.getItem("coUser")! + "&nameFile=" + pdfName;
      } catch {
        console.log("error", pdfName);
        return;
      }
      let date = new Date();
      try {
        const res = await Filesystem.downloadFile({
          url: url,
          path: pdfName,
          directory: Directory.Cache
        });
        this.listFilesPdf.push(pdfName);
        let name = pdfName;
        if (!this.mapPdfFiles.get(name))
          this.mapPdfFiles.set(name, [res.path!]);
        else
          this.mapPdfFiles.get(name)?.push(res.path!);

        localStorage.setItem("listFilesPdf", JSON.stringify(this.listFilesPdf));
        if (this.mapPdfFiles.size != 0)
          localStorage.setItem("mapPdfFiles", JSON.stringify(Array.from(this.mapPdfFiles.entries())));
      } catch (e) {
        console.log(e);
      }
    };

    while (queue.length > 0 || running.length > 0) {
      while (queue.length > 0 && running.length < concurrency) {
        const pdfName = queue.shift()!;
        running.push(worker(pdfName));
      }
      await Promise.race(running).then(() => {
        running.splice(0, 1); // Elimina la promesa resuelta
      });
    }
  }

  async downloadWithConcurrency(imagenesDownload: string[], concurrency: number = 3) {
    if (this.mapImages.size == 0 && localStorage.getItem("mapImages") != null) {
      this.mapImages = new Map(JSON.parse(localStorage.getItem("mapImages")!));
    }

    const queue = [...imagenesDownload];
    const running: Promise<void>[] = [];

    const worker = async (imgName: string) => {
      let url = "";
      try {
        url = this.buildDownloadUrl(imgName);
      } catch {
        console.log("buildDownloadUrl error:", imgName);
        return;
      }
      const date = Date.now();
      try {
        console.log('Downloading', url, '->', imgName);
        const fileResult: any = await Filesystem.downloadFile({
          url: url,
          path: imgName,
          directory: Directory.Cache
        });

        // Manejar distintas formas de respuesta (data / uri / path)
        let imgSrc = '';
        if (fileResult?.data) {
          imgSrc = 'data:image/png;base64,' + fileResult.data;
        } else if (fileResult?.uri) {
          imgSrc = fileResult.uri;
        } else if (fileResult?.path) {
          imgSrc = fileResult.path;
        } else {
          console.warn('Filesystem.downloadFile returned no data for', imgName, fileResult);
          return;
        }

        this.imageLoaded$.next({ imgName, imgSrc });
        this.allFileList.push({
          name: imgName.split(".")[0],
          date: date,
          path: fileResult.path!,
          fechaCreacion: date.toString(),
        });
        this.listFilesImages.push(imgName);
        let name = imgName.split(".")[0].split("_")[0];
        if (!this.mapImages.get(name))
          this.mapImages.set(name, [fileResult.path!]);
        else
          this.mapImages.get(name)?.push(fileResult.path!);

        localStorage.setItem("listFilesImages", JSON.stringify(this.listFilesImages));
        if (this.mapImages.size != 0)
          localStorage.setItem("mapImages", JSON.stringify(Array.from(this.mapImages.entries())));

        // Lee la imagen y emite el resultado para mostrarla en tiempo real
        const fileResultRead = await Filesystem.readFile({
          path: "file://" + fileResult.path!,
        });
        const base64 = 'data:image/png;base64,' + fileResultRead.data;
        this.imageLoaded$.next({ imgName, imgSrc: base64 });
      } catch (e) {
        console.error('Download error', imgName, url, e);
      }
    };

    const schedule = () => {
      while (queue.length > 0 && running.length < concurrency) {
        const imgName = queue.shift()!;
        let p: Promise<void>;
        p = worker(imgName).finally(() => {
          const idx = running.indexOf(p);
          if (idx > -1) running.splice(idx, 1);
        });
        running.push(p);
      }
    };

    schedule();
    // Espera hasta que todo termine
    while (running.length > 0 || queue.length > 0) {
      if (running.length > 0) {
        await Promise.race(running);
      } else {
        // si no hay en ejecución, inicializar más
        schedule();
      }
      schedule();
    }

  }

  async getImageUrl(imgName: string): Promise<string> {
    // 1. Verifica si ya tienes la imagen localmente
    const localPath = this.getLocalImagePath(imgName);
    if (localPath) {
      return localPath;
    }

    // 2. Si no, descárgala bajo demanda
    await this.downloadWithConcurrency([imgName]);
    const downloadedPath = this.getLocalImagePath(imgName);
    // Si sigue sin estar, retorna un placeholder
    return downloadedPath ?? 'assets/img/placeholder.png';
  }

  // Centralized download URL builder for product images
  private buildDownloadUrl(imgName: string): string {
    // imgName expected like '12345.png' or '12345_1.png' -> id is segment before first '.'
    const id = imgName.split('.')[0];
    return this.services.getURLService() + 'download?type=products&id=' + id;
  }

  private getLocalImagePath(imgName: string): string | null {
    const filePath = this.listFilesImages.find(name => name === imgName);
    if (filePath) {
      return filePath;
    }
    return null;
  }

  // Promise que hace lazy read/download y retorna base64 (memoizado en pendingLoads)
  async getImageBase64(imgName: string): Promise<string> {
    // 1) retorno rápido si ya está en caché de memoria
    if (this.mapImagesFilesByFilename.has(imgName)) {
      return this.mapImagesFilesByFilename.get(imgName)!;
    }
    // 2) si ya hay una carga en progreso, reutilizarla
    if (this.pendingLoads.has(imgName)) {
      return this.pendingLoads.get(imgName)!;
    }

    const loadPromise = (async () => {
      try {
        // 3) intenta encontrar una ruta local ya conocida (allFileList guarda path)
        const fileEntry = this.allFileList.find(it => (it.path.split('/').pop() === imgName));
        let readResultData: string | null = null;

        if (fileEntry && fileEntry.path) {
          try {
            // normalizamos el resultado a base64 string independientemente de si Filesystem devuelve string o Blob
            readResultData = await this.readFileResultToBase64('file://' + fileEntry.path);
          } catch (e) {
            // la ruta local falló, procedemos a descargar
            console.warn('[getImageBase64] readFile failed, will download', imgName, e);
          }
        }

        // 4) si no se leyó desde disco, descargar y luego leer
        if (!readResultData) {
          // use centralized URL builder (same as downloadWithConcurrency)
          const url = this.buildDownloadUrl(imgName);
          try {
            const res = await Filesystem.downloadFile({ url, path: imgName, directory: Directory.Cache });
            // registrar en estructuras locales
            this.allFileList.push({
              name: imgName.split('.')[0],
              date: Date.now(),
              path: res.path!,
              fechaCreacion: Date.now().toString(),
            });
            this.listFilesImages.push(imgName);
            const productKey = imgName.split('.')[0].split('_')[0];
            if (!this.mapImages.get(productKey)) this.mapImages.set(productKey, [res.path!]);
            else this.mapImages.get(productKey)?.push(res.path!);

            // persistir meta info (NO persistir base64)
            localStorage.setItem('listFilesImages', JSON.stringify(this.listFilesImages));
            if (this.mapImages.size !== 0) localStorage.setItem('mapImages', JSON.stringify(Array.from(this.mapImages.entries())));

            // leer archivo recien descargado
            // normalizamos el resultado a base64 string independientemente de si Filesystem devuelve string o Blob
            readResultData = await this.readFileResultToBase64('file://' + res.path!);
          } catch (err) {
            // console.error('[getImageBase64] download/read failed for', imgName, err);
            throw err;
          }
        }

        // 5) construir base64 y guardar en caché en memoria
        const base64 = 'data:image/png;base64,' + readResultData;
        this.mapImagesFilesByFilename.set(imgName, base64);

        // 6) también emitir event global para compatibilidad con consumidores existentes
        this.imageLoaded$.next({ imgName, imgSrc: base64 });

        // 7) notificar subscribers interesados por ese imgName (si existen)
        const subj = this.imageSubjects.get(imgName);
        if (subj) subj.next(base64);

        return base64;
      } finally {
        // limpiar pendingLoads al finalizar o fallar
        this.pendingLoads.delete(imgName);
      }
    })();

    this.pendingLoads.set(imgName, loadPromise);
    return loadPromise;
  }

  getImageObservable(imgName?: string): Observable<string> {
    const placeholder = '../../../assets/images/nodisponible.png';
    // If no name provided, immediately return placeholder
    if (!imgName) return of(placeholder);

    // Fast path: if we already have the base64 in memory, return it
    if (this.mapImagesFilesByFilename.has(imgName)) {
      return of(this.mapImagesFilesByFilename.get(imgName)!);
    }

    // If a subject already exists for this imgName, ensure load is started and
    // map any null emissions to the placeholder.
    if (this.imageSubjects.has(imgName)) {
      const s = this.imageSubjects.get(imgName)!;
      if (!this.pendingLoads.has(imgName)) {
        this.getImageBase64(imgName).catch(() => { /* swallow, handled elsewhere */ });
      }
      return s.asObservable().pipe(map(v => v ?? placeholder));
    }

    // Create a subject (starts with null) and trigger a background load.
    const subject = new BehaviorSubject<string | null>(null);
    this.imageSubjects.set(imgName, subject);

    // Trigger the load; getImageBase64 will update the subject when ready.
    this.getImageBase64(imgName).catch(err => {
      console.warn('[getImageObservable] load failed for', imgName, err);
      // leave subject at null; mapping below will convert to placeholder for subscribers
    });

    // Always map null -> placeholder so this method returns Observable<string>
    return subject.asObservable().pipe(map(v => v ?? placeholder));
  }

  // Helper para leer y normalizar el resultado de Filesystem.readFile a base64 string
  private async readFileResultToBase64(path: string): Promise<string> {
    const fileResult = await Filesystem.readFile({ path });
    // fileResult.data puede ser string (base64) o Blob dependiendo de la plataforma / lib
    const data: any = (fileResult as any).data;
    if (typeof data === 'string') {
      return data;
    }
    // Si es Blob, convertir a base64 (sin el prefijo data:.../, retornamos solo la parte base64)
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      return await this.blobToBase64(data);
    }
    // Fallback: intentar stringify
    return String(data);
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('blobToBase64: FileReader error'));
      reader.onload = () => {
        const result = reader.result as string;
        // result es "data:<mime>;base64,<base64data>" -> devolvemos solo la parte base64
        const commaIndex = result.indexOf(',');
        if (commaIndex >= 0) {
          resolve(result.substring(commaIndex + 1));
        } else {
          resolve(result);
        }
      };
      reader.readAsDataURL(blob);
    });
  }

  clearMemoryCache() {
    this.mapImagesFilesByFilename.clear();
    // opcional: también limpiar subjects
    this.imageSubjects.forEach(s => s.complete());
    this.imageSubjects.clear();
    this.pendingLoads.clear();

  }

  public emitCachedImages(): void {
    // 1) si tenemos cache por filename (mapImagesFilesByFilename), emite cada entry
    try {
      if (this.mapImagesFilesByFilename && this.mapImagesFilesByFilename.size > 0) {
        for (const [imgName, base64] of this.mapImagesFilesByFilename.entries()) {
          if (base64) {
            this.imageLoaded$.next({ imgName, imgSrc: base64 });
          }
        }
      }

      // 2) si tienes la estructura antigua mapImagesFiles: Map<productKey, base64[]>
      // y mapImages: Map<productKey, paths[]>, intenta casar índices para emitir filename->base64
      if (this.mapImagesFiles && this.mapImagesFiles.size > 0 && this.mapImages && this.mapImages.size > 0) {
        for (const [productKey, base64Array] of this.mapImagesFiles.entries()) {
          const paths = this.mapImages.get(productKey) || [];
          for (let i = 0; i < base64Array.length; i++) {
            const b64 = base64Array[i];
            const path = paths[i];
            const filename = path ? path.split('/').pop() : null;
            if (filename && b64) {
              this.imageLoaded$.next({ imgName: filename!, imgSrc: b64 });
            }
          }
        }
      }

      // 3) fallback: si solo tienes mapImages (rutas) y no base64, puedes optar por iniciar lecturas lazy:
      // (descomentá si querés forzar lectura inmediata - cuidado con I/O)
      // for (const [productKey, paths] of this.mapImages.entries()) {
      //   for (const p of paths) {
      //     const filename = p.split('/').pop();
      //     if (filename) this.getImageBase64(filename).catch(()=>{});
      //   }
      // }

    } catch (err) {
      console.warn('[emitCachedImages] failed', err);
    }
  }

  private getFilenameFromPath(path?: string): string | null {
    if (!path) return null;
    return path.split('/').pop() || null;
  }

  // Normaliza nombres como "12345.png" y "12345_1.png" al mismo productId ("12345")
  private getProductKeyFromFilename(filename: string): string {
    const basename = filename.split('.')[0] || filename;
    return basename.split('_')[0];
  }

  private sortRelatedFilenames(productId: string, filenames: string[]): string[] {
    const rank = (filename: string): [number, number, string] => {
      const stem = filename.split('.')[0] || filename;
      if (stem === productId) return [0, 0, filename];
      if (stem.startsWith(productId + '_')) {
        const suffix = stem.substring(productId.length + 1);
        const parsed = Number(suffix);
        if (suffix !== '' && Number.isFinite(parsed)) return [1, parsed, filename];
        return [2, 0, filename];
      }
      return [3, 0, filename];
    };

    return [...filenames].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra[0] !== rb[0]) return ra[0] - rb[0];
      if (ra[1] !== rb[1]) return ra[1] - rb[1];
      return ra[2].localeCompare(rb[2]);
    });
  }

  public getRelatedImageFilenames(productId: string): string[] {
    if (!productId) return [];

    const candidates = new Set<string>();

    const paths = this.mapImages.get(productId) || [];
    for (const p of paths) {
      const filename = this.getFilenameFromPath(p);
      if (filename) candidates.add(filename);
    }

    for (const f of this.listFilesImages) {
      if (this.getProductKeyFromFilename(f) === productId) {
        candidates.add(f);
      }
    }

    for (const [filename] of this.mapImagesFilesByFilename.entries()) {
      if (this.getProductKeyFromFilename(filename) === productId) {
        candidates.add(filename);
      }
    }

    for (const item of this.allFileList) {
      const filename = this.getFilenameFromPath(item.path);
      if (filename && this.getProductKeyFromFilename(filename) === productId) {
        candidates.add(filename);
      }
    }

    return this.sortRelatedFilenames(productId, Array.from(candidates));
  }

  public async getImagesForProduct(productId: string): Promise<string[]> {
    const filenames = this.getRelatedImageFilenames(productId);
    if (filenames.length === 0) {
      return [];
    }

    const resolved: string[] = [];

    for (const filename of filenames) {
      if (this.mapImagesFilesByFilename.has(filename)) {
        const cached = this.mapImagesFilesByFilename.get(filename);
        if (cached) resolved.push(cached);
        continue;
      }

      try {
        const base64 = await this.getImageBase64(filename);
        if (base64) resolved.push(base64);
      } catch (err) {
        console.warn('[getImagesForProduct] failed loading', filename, err);
      }
    }

    if (resolved.length === 0 && this.mapImagesFiles.has(productId)) {
      const legacy = this.mapImagesFiles.get(productId) || [];
      for (const img of legacy) {
        if (img) resolved.push(img);
      }
    }

    return resolved;
  }


  public getImgForProduct(productId: string): string | null {
    if (!productId) return null;

    try {
      const relatedFilenames = this.getRelatedImageFilenames(productId);

      // 1) Buscar en cache por nombre de archivo (mapImagesFilesByFilename: filename -> base64)
      for (const filename of relatedFilenames) {
        const base64 = this.mapImagesFilesByFilename.get(filename);
        if (base64) {
          return base64;
        }
      }

      // 2) Compatibilidad con estructura antigua: mapImagesFiles: Map<productKey, base64[]>
      if (this.mapImagesFiles && this.mapImagesFiles.has(productId)) {
        const arr = this.mapImagesFiles.get(productId) || [];
        if (arr.length > 0 && arr[0]) return arr[0];
      }

      // 3) Si no hay base64 en caché, disparar carga asíncrona de la primera imagen relacionada
      const firstFilename = relatedFilenames[0];
      if (firstFilename) {
        this.getImageBase64(firstFilename).catch(err => {
          console.warn('[getImgForProduct] background load failed for', firstFilename, err);
        });
      }

      // 4) Fallback: buscar en allFileList por nombre (allFileList guarda objetos con name y path)
      const fl = this.allFileList.find(it => it.name === productId || it.name.startsWith(productId + '_'));
      if (fl && fl.path) {
        const filename = fl.path.split('/').pop();
        if (filename) {
          if (this.mapImagesFilesByFilename.has(filename)) {
            return this.mapImagesFilesByFilename.get(filename)!;
          }
          // disparar carga en background si no estaba en caché
          this.getImageBase64(filename).catch(err => {
            console.warn('[getImgForProduct] background load failed for', filename, err);
          });
        }
      }
    } catch (err) {
      console.warn('[getImgForProduct] unexpected error', err);
    }

    // Si llegamos aquí, no hay imagen lista; retornar null (puede usarse placeholder en la UI)
    return '../../../assets/images/nodisponible.png';
  }

  /**
   * Delete images from disk and update all in-memory and persisted metadata.
   * If listImagesDelete is omitted, uses this.removeFileList.
   * Returns a summary of deleted and failed items.
   */
  public async deleteImages(listImagesDelete?: string[]): Promise<{ deleted: string[]; failed: { name: string; error: any }[] }> {
    const input = (listImagesDelete && listImagesDelete.length > 0) ? listImagesDelete : (this.removeFileList || []);
    const toDelete = Array.from(new Set(input)); // dedupe
    const deleted: string[] = [];
    const failed: { name: string; error: any }[] = [];

    if (toDelete.length === 0) {
      return { deleted, failed };
    }

    for (const filename of toDelete) {
      try {
        // Try deleting by filename first (same path used when downloading: path === filename)
        try {
          await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
        } catch (e1) {
          // Fallback: try to find an entry in allFileList and delete by stored path
          const entry = this.allFileList.find(it => it.path && it.path.split('/').pop() === filename);
          if (entry && entry.path) {
            // Filesystem.deleteFile expects a relative path; if entry.path contains directories, pass the last segment or the full path depending on platform
            let candidatePath = entry.path;
            // strip file:// if present
            if (candidatePath.startsWith('file://')) candidatePath = candidatePath.replace('file://', '');
            try {
              await Filesystem.deleteFile({ path: candidatePath, directory: Directory.Cache });
            } catch {
              // If still failing, try deleting by the filename relative to Cache (best-effort)
              await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
            }
          } else {
            // rethrow original to be handled by outer catch
            throw e1;
          }
        }

        // Update in-memory structures
        // Keep a snapshot of previous paths for index reconciliation with mapImagesFiles
        const productKey = filename.split('.')[0].split('_')[0];
        const prevPaths = this.mapImages.get(productKey) ? [...this.mapImages.get(productKey)!] : [];

        // Remove from listFilesImages
        this.listFilesImages = this.listFilesImages.filter(n => n !== filename);

        // Remove from mapImagesFilesByFilename (filename -> base64 cache)
        this.mapImagesFilesByFilename.delete(filename);

        // Remove from mapImages (productKey -> paths[])
        if (this.mapImages.has(productKey)) {
          const newPaths = this.mapImages.get(productKey)!.filter(p => p.split('/').pop() !== filename);
          if (newPaths.length === 0) this.mapImages.delete(productKey);
          else this.mapImages.set(productKey, newPaths);
        }

        // Reconcile mapImagesFiles (productKey -> base64[]) by removing entries whose indices correspond to removed paths
        if (this.mapImagesFiles.has(productKey)) {
          const base64Arr = [...this.mapImagesFiles.get(productKey)!];
          const indicesToRemove: number[] = [];
          for (let i = 0; i < prevPaths.length; i++) {
            const p = prevPaths[i];
            if (p && p.split('/').pop() === filename) indicesToRemove.push(i);
          }
          // Remove indices from highest to lowest to keep indexes valid
          indicesToRemove.sort((a, b) => b - a).forEach(idx => {
            if (idx >= 0 && idx < base64Arr.length) base64Arr.splice(idx, 1);
          });
          if (base64Arr.length === 0) this.mapImagesFiles.delete(productKey);
          else this.mapImagesFiles.set(productKey, base64Arr);
        }

        // Remove from allFileList
        this.allFileList = this.allFileList.filter(it => it.path.split('/').pop() !== filename && it.name !== filename.split('.')[0]);

        // Notify subscribers: per-image subject and global imageLoaded$ with placeholder
        const placeholder = '../../../assets/images/nodisponible.png';
        const subj = this.imageSubjects.get(filename);
        if (subj) {
          // set to null so getImageObservable mapping will convert to placeholder
          subj.next(null);
        }
        this.imageLoaded$.next({ imgName: filename, imgSrc: placeholder });

        deleted.push(filename);
      } catch (err) {
        failed.push({ name: filename, error: err });
        console.warn('[deleteImages] failed deleting', filename, err);
      }
    }

    // Persist metadata once after processing all deletions
    try {
      localStorage.setItem('listFilesImages', JSON.stringify(this.listFilesImages));
      if (this.mapImages.size !== 0) localStorage.setItem('mapImages', JSON.stringify(Array.from(this.mapImages.entries())));
      if (this.mapImagesFiles.size !== 0) localStorage.setItem('mapImagesFiles', JSON.stringify(Array.from(this.mapImagesFiles.entries())));
    } catch (e) {
      console.warn('[deleteImages] failed persisting metadata', e);
    }

    return { deleted, failed };
  }

  async getServerLogoList() {
    if (localStorage.getItem('listFilesLogos') != null) {
      this.listFilesLogos = JSON.parse(localStorage.getItem('listFilesLogos')!);
    }
    if (localStorage.getItem('mapLogos') != null) {
      this.mapLogos = new Map(JSON.parse(localStorage.getItem('mapLogos')!));
    }

    const opt = this.services.getHttpOptionsAuthorization();
    opt.url = this.services.getURLService() + 'listfilespremium';
    opt.data = {
      type: 'logos',
      naImages: this.listFilesLogos
    };

    return from(CapacitorHttp.post(opt)).pipe(
      map(resp => {
        if (resp.data.errorCode !== '000') {
          return '';
        }
        this.downloadFileListLogos = this.filterNonImageFiles(resp.data.downloadFileList || []);
        this.removeFileListLogos = this.filterNonImageFiles(resp.data.removeFileList || []);
        if (this.removeFileListLogos.length > 0) {
          this.deleteLogos(this.removeFileListLogos);
        }
        return resp;
      })
    );
  }

  async downloadLogosWithConcurrency(logosDownload?: string[], concurrency: number = 3): Promise<void> {
    const imagenesDownload = logosDownload ?? this.downloadFileListLogos;
    if (!imagenesDownload || imagenesDownload.length === 0) {
      return;
    }

    const queue = [...imagenesDownload];
    const running: Promise<void>[] = [];

    const schedule = () => {
      while (queue.length > 0 && running.length < concurrency) {
        const logoName = queue.shift()!;
        let p: Promise<void>;
        p = this.downloadSingleLogo(logoName).finally(() => {
          const idx = running.indexOf(p);
          if (idx > -1) {
            running.splice(idx, 1);
          }
        });
        running.push(p);
      }
    };

    schedule();
    while (running.length > 0 || queue.length > 0) {
      if (running.length > 0) {
        await Promise.race(running);
      }
      schedule();
    }
  }

  async getLogoBase64ForEnterprise(coEnterprise?: string | null): Promise<string | null> {
    if (!coEnterprise) {
      return null;
    }

    const filename = this.findLogoFilename(coEnterprise);
    if (filename) {
      if (this.mapLogosByFilename.has(filename)) {
        return this.mapLogosByFilename.get(filename)!;
      }

      try {
        const path = this.mapLogos.get(coEnterprise.toLowerCase()) ?? this.mapLogos.get(coEnterprise);
        if (path) {
          const raw = await this.readFileResultToBase64(this.normalizeFileUri(path));
          const base64 = this.buildDataUri(filename, raw);
          this.mapLogosByFilename.set(filename, base64);
          return base64;
        }
        await this.downloadSingleLogo(filename);
        const downloaded = this.mapLogosByFilename.get(filename);
        if (downloaded) {
          return downloaded;
        }
      } catch (err) {
        console.warn('[getLogoBase64ForEnterprise] failed for', coEnterprise, err);
      }
    }

    // Fallback: intentar descargar por codigo de empresa + extension comun.
    for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
      const candidate = `${coEnterprise}.${ext}`;
      try {
        if (this.mapLogosByFilename.has(candidate)) {
          return this.mapLogosByFilename.get(candidate)!;
        }
        await this.downloadSingleLogo(candidate);
        const downloaded = this.mapLogosByFilename.get(candidate);
        if (downloaded) {
          return downloaded;
        }
      } catch {
        /* continuar con siguiente extension */
      }
    }

    return null;
  }

  private async downloadSingleLogo(logoName: string): Promise<void> {
    const url = this.buildLogoDownloadUrl(logoName);
    try {
      const fileResult: any = await Filesystem.downloadFile({
        url,
        path: logoName,
        directory: Directory.Cache
      });
      if (!fileResult?.path) {
        return;
      }

      const enterpriseKey = this.getEnterpriseKeyFromFilename(logoName);
      this.listFilesLogos = Array.from(new Set([...this.listFilesLogos, logoName]));
      this.mapLogos.set(enterpriseKey, fileResult.path);

      const raw = await this.readFileResultToBase64(this.normalizeFileUri(fileResult.path));
      const base64 = this.buildDataUri(logoName, raw);
      this.mapLogosByFilename.set(logoName, base64);

      localStorage.setItem('listFilesLogos', JSON.stringify(this.listFilesLogos));
      localStorage.setItem('mapLogos', JSON.stringify(Array.from(this.mapLogos.entries())));
    } catch (e) {
      console.error('Logo download error', logoName, url, e);
    }
  }

  private async deleteLogos(listLogosDelete: string[]): Promise<void> {
    const toDelete = Array.from(new Set(listLogosDelete));
    for (const filename of toDelete) {
      try {
        await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
      } catch (err) {
        console.warn('[deleteLogos] failed deleting', filename, err);
      }
      const enterpriseKey = this.getEnterpriseKeyFromFilename(filename);
      this.listFilesLogos = this.listFilesLogos.filter(n => n !== filename);
      this.mapLogos.delete(enterpriseKey);
      this.mapLogosByFilename.delete(filename);
    }
    localStorage.setItem('listFilesLogos', JSON.stringify(this.listFilesLogos));
    localStorage.setItem('mapLogos', JSON.stringify(Array.from(this.mapLogos.entries())));
  }

  private buildLogoDownloadUrl(logoName: string): string {
    return this.services.getURLService() + 'download?type=logos&id=' + encodeURIComponent(logoName);
  }

  private findLogoFilename(coEnterprise: string): string | null {
    const key = coEnterprise.toLowerCase();
    const fromList = this.listFilesLogos.find(name => this.getEnterpriseKeyFromFilename(name) === key)
      ?? this.downloadFileListLogos.find(name => this.getEnterpriseKeyFromFilename(name) === key);
    if (fromList) {
      return fromList;
    }
    const path = this.mapLogos.get(key) ?? this.mapLogos.get(coEnterprise);
    return path ? path.split('/').pop() ?? null : null;
  }

  private getEnterpriseKeyFromFilename(filename: string): string {
    const basename = filename.split('/').pop() || filename;
    const dot = basename.lastIndexOf('.');
    return (dot > 0 ? basename.substring(0, dot) : basename).toLowerCase();
  }

  private filterNonImageFiles(files: string[]): string[] {
    return (files || []).filter(name => {
      const ext = (name.split('.').pop() || '').toLowerCase();
      return ext !== 'db' && ext !== 'ini';
    });
  }

  private buildDataUri(filename: string, rawBase64: string): string {
    const ext = (filename.split('.').pop() || 'png').toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
          : 'image/png';
    return `data:${mime};base64,${rawBase64}`;
  }

  private normalizeFileUri(path: string): string {
    return path.startsWith('file://') ? path : 'file://' + path;
  }

}