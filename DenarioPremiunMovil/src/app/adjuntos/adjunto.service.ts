import { inject, Injectable } from '@angular/core';
import { Directory, Filesystem, ReadFileOptions } from '@capacitor/filesystem';
import { GalleryPhoto } from '@capacitor/camera';
import { Foto } from '../modelos/foto';
import { PendingTransaction } from '../modelos/tables/pendingTransactions';
import { TransactionImage } from '../modelos/tables/transactionImage';
import { ServicesService } from '../services/services.service';
import { TransactionSignature } from '../modelos/tables/transactionSignature';
import { Subject, startWith } from 'rxjs';
import { PickedFile } from '@capawesome/capacitor-file-picker';
import { TransactionFile } from '../modelos/tables/transactionFile';
import { Archivo } from '../modelos/archivo';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';
import { SQLiteObject } from '@awesome-cordova-plugins/sqlite';
import { SynchronizationComponent } from '../synchronization/synchronization.component';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { PendingTransactionsAttachments } from '../modelos/tables/pendingTransactionsAttachments';


@Injectable({
  providedIn: 'root'
})
export class AdjuntoService {

  public signatureChanged: Subject<string> = new Subject<string>();


  tags = new Map<string, string>([]);
  public fotos: Foto[] = [];

  public files: Archivo[] = [];
  public filenameSet = new Set<string>(); //para evitar archivos con el mismo nombre
  public firma: string = ""; //data de la firma en URL
  public signatureConfig: boolean = false; // si la firma esta habilitada en este modulo.
  public viewOnly: boolean = false;

  public colorBoton = ''

  public quAttach = 5 //cantidad de fotos que se pueden adjuntar
  public quFileAttach = 1; //cantidad de archivos que se pueden adjuntar (no fotos, sino otros tipos de archivos)
  public processingPhotos = 0; //cantidad de fotos que se estan procesando actualmente
  public processingFiles = 0; //cantidad de archivos que se estan procesando actualmente

  imageWeightLimit = 30; //limite de peso de imagenes, en MB
  fileWeightLimit = 50; //limite de peso de archivos, en MB
  public showCamera = true;
  public userCanUploadFiles = true;


  //flag que se levanta si un archivo excede weightLimit
  weightLimitExceeded = false;



  public moduleName: string = '';

  public AttachmentChanged = new Subject<any>();
  public AttachmentWeightExceeded = new Subject<any>();
  public attachmentsLoaded = new Subject<void>();

  public config = inject(GlobalConfigService);

  public servicesServ = inject(ServicesService);

  private uploadQueue: Promise<void> = Promise.resolve();
  private isUploadingAttachments = false;

  constructor() { }

  setup(dbServ: SQLiteObject, tieneFirma: boolean, viewOnly: boolean, colorBoton: string) {
    this.fotos = [];
    this.firma = "";
    this.files = [];
    this.filenameSet = new Set<string>();
    this.getTags(dbServ);
    this.signatureConfig = tieneFirma;
    this.viewOnly = viewOnly;
    this.colorBoton = colorBoton;
    this.quAttach = +this.config.get('quAttach');
    if(this.config.get('quFileAttach').length > 0){
      this.quFileAttach = +this.config.get('quFileAttach');
    }else{
      this.quFileAttach = 1;
    }    
    this.showCamera = this.config.get('showCamera') === 'true' ? true : false;
    this.userCanUploadFiles = this.config.get('userCanUploadFiles') === 'true' ? true : false;
    let weightLimit = this.config.get('imageWeightLimit');
    this.imageWeightLimit = weightLimit.length > 0 ? +weightLimit : 30; //mientras se corren scripts de actualizacion
    //console.log('totalPhoto: '+this.totalPhoto);
    //console.log('imageWeightLimit: '+this.imageWeightLimit);
  }

  deleteImg(pos: number) {
    this.fotos.splice(pos, 1);
    this.weightLimitExceeded = false; //resetea el flag de limite de peso
    for (let i = 0; i < this.fotos.length; i++) {
      const f = this.fotos[i];
      if (this.getFileWeight(f.data as string) > this.imageWeightLimit) {
        this.weightLimitExceeded = true;
        break;
      }
    }
  }

  deleteFile(pos: number) {
    this.filenameSet.delete(this.files[pos].naFile);
    this.files.splice(pos, 1);
    this.weightLimitExceeded = false;
    for (let i = 0; i < this.files.length; i++) {
      const f = this.files[i];
      if (this.getFileWeight(f.data as string) > this.fileWeightLimit) {
        this.weightLimitExceeded = true;
        break;
      }
    }
  }

  remainingFotos() {
    let n = this.quAttach - this.processingPhotos - this.fotos.length;
    if (n < 0) {
      n = 0;
    }
    return n;
  }

  getNuAttachment() {
    //la cantidad de fotos adjuntadas
    let total = this.fotos.length;
    if (this.files.length > 0) {
      //si tiene archivos, eso cuenta como adjuntos adicionales.
      total += this.files.length;
    }
    /*
    if(this.firma != "") {
      //igual con la firma (?)
      total++
    }
      */
    return total;
  }

  hasItems() {
    return ((this.fotos.length > 0) || (this.files.length > 0))
  }

  tieneFirma() {
    return (this.firma != "");
  }


  getFileWeight(file: string) {
    //cada byte requiere 4/3 caracteres para representarlos
    //luego dividimos para obtener MB
    return ((Math.ceil(file.length / 4)) * 3) / 1000000
  }

  async addImg(img: GalleryPhoto) {
    var options: ReadFileOptions = {
      path: img.path ? img.path : ''
    }
    var webpath = img.webPath.split('.')

    if (img.path && img.path != '') {
      var file = await Filesystem.readFile(options);
      //console.log('PESO DE IMG: '+ this.getFileWeight(file.data as string) + " MB");
      var peso = this.getFileWeight(file.data as string);
      var muyPesado = peso > this.imageWeightLimit
      if (muyPesado) {
        this.weightLimitExceeded = true;
      } else {
        //this.weightLimitExceeded = false;
      }
      var foto = new Foto(
        webpath[webpath.length - 1],
        file.data as string,
        "",
        muyPesado
      )
      this.fotos.push(foto);

    }

  }

  async savePhotos(dbServ: SQLiteObject, coTransaction: string, naTransaction: string) {
    //guardar los archivos en la app
    var batch = [];

    //borro todo y comienzo de 0
    var deleteStatement = "DELETE from transaction_images WHERE co_transaction = ? " +
      "AND na_transaction = ?"
    batch.push([deleteStatement, [coTransaction, naTransaction]]);
    //borro todo y comienzo de 0
    var deleteStatement = "DELETE from transaction_signatures WHERE co_transaction = ? " +
      "AND na_transaction = ?"
    batch.push([deleteStatement, [coTransaction, naTransaction]]);
    //borro todo y comienzo de 0
    var deleteStatement = "DELETE from transaction_files WHERE co_transaction = ? " +
      "AND na_transaction = ?"
    batch.push([deleteStatement, [coTransaction, naTransaction]]);

    var saveStatement = "INSERT OR REPLACE INTO transaction_images" +
      "(co_transaction, na_transaction, na_image)" +
      " VALUES (?, ?, ?)"

    const saveTransacctionImages = "INSERT INTO pending_transactions_attachments" +
      "(na_attachment, id_transaction, co_transaction, type, na_transaction, position)" +
      " VALUES (?, ?, ?, ?, ?, ?)"

    let position = this.fotos.length ? null : -1;

    for (let i = 0; i < this.fotos.length; i++) {
      const f = this.fotos[i];
      if (f.data) {
        var filename = coTransaction + "_" + i + "." + f.tipo;
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: f.data,
          directory: Directory.External
        });
        f.naImage = filename;

        batch.push([saveStatement, [coTransaction, naTransaction, filename]]);
        batch.push([saveTransacctionImages, [filename, 0, coTransaction, "attach", naTransaction, i]]);

      }
    }
    if (this.firma != "") {
      var saveStatement = "INSERT OR REPLACE INTO transaction_signatures" +
        "(co_transaction, na_transaction, na_image)" +
        " VALUES (?, ?, ?)"
      const saveTransacctionImages = "INSERT INTO pending_transactions_attachments" +
        "(na_attachment, id_transaction, co_transaction, type, na_transaction, position)" +
        " VALUES (?, ?, ?, ?, ?, ?)"
      var filename = coTransaction + "_Signature.jpg";
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: this.firma,
        directory: Directory.External
      });
      batch.push([saveStatement, [coTransaction, naTransaction, filename]]);
      batch.push([saveTransacctionImages, [filename, 0, coTransaction, "signature", naTransaction, 0]]);
    }
    for (let j = 0; j < this.files.length; j++) {
      //guardamos los archivos en BD
      var saveStatement = "INSERT OR REPLACE INTO transaction_files" +
        "(co_transaction, na_transaction, na_file)" +
        " VALUES (?, ?, ?)"
      const saveTransacctionImages = "INSERT INTO pending_transactions_attachments" +
        "(na_attachment, id_transaction, co_transaction, type, na_transaction, position)" +
        " VALUES (?, ?, ?, ?, ?, ?)"

      //var filename = coTransaction + "_File" + this.file.name.split('.')[-1];
      const savedFile = await Filesystem.writeFile({
        path: this.files[j].naFile,
        data: this.files[j].data as string,
        directory: Directory.External
      });
      batch.push([saveStatement, [coTransaction, naTransaction, this.files[j].naFile]]);
      batch.push([saveTransacctionImages, [this.files[j].naFile, 0, coTransaction, "file", naTransaction, j]]);
    }


    return dbServ.sqlBatch(batch).then(result => {
      console.log(result);
    }).catch(error => {
      console.log(error);
      throw error;
    });

  }

  getTransactionImage(dbServ: SQLiteObject, id: number) {
    var retrieveStatement = "SELECT id_transaction_image as idTransactionImage," +
      "na_transaction as naTransaction, " +
      "co_transaction as coTransaction, " +
      "na_image as naImage from transaction_images" +
      "WHERE id_transaction_image = ?"

    return dbServ.executeSql(retrieveStatement, [id]).then(data => {
      return data.rows.item(0) as TransactionImage;
    })
  }

  getImagesByTransaction(dbServ: SQLiteObject, co_transaction: string, na_transaction: string) {
    var retrieveStatement = "SELECT id_transaction_image as idTransactionImage," +
      "na_transaction as naTransaction, " +
      "co_transaction as coTransaction, " +
      "na_image as naImage from transaction_images " +
      "WHERE co_transaction = ? and na_transaction = ?"

    return dbServ.executeSql(retrieveStatement, [co_transaction, na_transaction]).then(data => {
      let images: TransactionImage[] = [];
      for (let i = 0; i < data.rows.length; i++) {
        let item = data.rows.item(i);
        images.push(item);
      }
      return images;
    })
  }

  getSignatureByTransaction(dbServ: SQLiteObject, co_transaction: string, na_transaction: string) {
    var retrieveStatement = "SELECT id_transaction_signature as idTransactionSignature," +
      "na_transaction as naTransaction, " +
      "na_image as naImage from transaction_signatures " +
      "WHERE co_transaction = ? and na_transaction = ?"

    return dbServ.executeSql(retrieveStatement, [co_transaction, na_transaction]).then(data => {
      let sign = {} as TransactionSignature;
      //for (let i = 0; i < data.rows.length; i++) {
      sign = data.rows.item(0);
      //images.push(item);

      return sign;

    })
  }

  getFileByTransaction(dbServ: SQLiteObject, co_transaction: string, na_transaction: string) {
    var retrieveStatement = "SELECT id_transaction_files as idTransactionFile," +
      "na_file as naFile from transaction_files " +
      "WHERE co_transaction = ? and na_transaction = ?"

    return dbServ.executeSql(retrieveStatement, [co_transaction, na_transaction]).then(data => {
      let files: TransactionFile[] = [];

      for (let i = 0; i < data.rows.length; i++) {
        files.push(data.rows.item(i));
      }


      return files;

    })
  }

  getNuAttachImages(dbServ: SQLiteObject, co_transaction: string, na_transaction: string) {
    let nuAttachImages: number = 0;
    var selectStamentImages = "SELECT COUNT(*) AS count FROM transaction_images " +
      "WHERE co_transaction = ? and na_transaction = ?"

    var selectStamentFiles = "SELECT COUNT(*) AS count FROM transaction_files " +
      "WHERE co_transaction = ? and na_transaction = ?"

    return dbServ.executeSql(selectStamentImages, [co_transaction, na_transaction]).then(data => {
      nuAttachImages = data.rows.item(0).count;
      return dbServ.executeSql(selectStamentFiles, [co_transaction, na_transaction]).then(data => {
        return nuAttachImages += data.rows.item(0).count;
      })
    })
  }

  async sendPendingPhotos(dbServ: SQLiteObject, pendingTransactionsAttachments: PendingTransactionsAttachments[]) {
    if (!pendingTransactionsAttachments.length) {
      return;
    }

    return this.runWithUploadMutex(async () => {
      for (const item of pendingTransactionsAttachments) {
        const cantidad = item.type === 'signature'
          ? Math.max(0, (item.cantidad ?? 1) - 1)
          : (item.cantidad ?? 1);
        await this.uploadPendingAttachment(dbServ, {
          naTransaction: item.naTransaction,
          idTransaction: item.idTransaction,
          coTransaction: item.coTransaction,
          naAttachment: item.naAttachment,
          type: item.type,
          position: item.position,
          cantidad,
        });
      }
    });
  }

  async sendPhotos(dbServ: SQLiteObject, idTransaction: number, naTransaction: string, coTransaction: string) {
    return this.runWithUploadMutex(async () => {
      const cantidad = await this.getNuAttachImages(dbServ, coTransaction, naTransaction);
      const uploadItems: UploadAttachmentParams[] = [];

      const imagesResult = await dbServ.executeSql(
        'SELECT na_image as naImage FROM transaction_images WHERE na_transaction = ? AND co_transaction = ?',
        [naTransaction, coTransaction],
      );
      for (let i = 0; i < imagesResult.rows.length; i++) {
        const naImage = imagesResult.rows.item(i).naImage as string;
        uploadItems.push({
          naTransaction,
          idTransaction,
          coTransaction,
          naAttachment: naImage,
          type: 'attach',
          position: i,
          cantidad,
        });
      }

      const signatureResult = await dbServ.executeSql(
        'SELECT na_image as naImage FROM transaction_signatures WHERE na_transaction = ? AND co_transaction = ?',
        [naTransaction, coTransaction],
      );
      if (signatureResult.rows.length > 0) {
        const naImage = signatureResult.rows.item(0).naImage as string;
        uploadItems.push({
          naTransaction,
          idTransaction,
          coTransaction,
          naAttachment: naImage,
          type: 'signature',
          position: 0,
          cantidad: Math.max(0, cantidad - 1),
        });
      }

      const filesResult = await dbServ.executeSql(
        'SELECT na_file as naFile FROM transaction_files WHERE na_transaction = ? AND co_transaction = ?',
        [naTransaction, coTransaction],
      );
      for (let i = 0; i < filesResult.rows.length; i++) {
        const naFile = filesResult.rows.item(i).naFile as string;
        uploadItems.push({
          naTransaction,
          idTransaction,
          coTransaction,
          naAttachment: naFile,
          type: 'file',
          position: i,
          cantidad,
        });
      }

      console.log('[AdjuntoService] Enviando adjuntos:', uploadItems.length);
      for (const item of uploadItems) {
        await this.uploadPendingAttachment(dbServ, item);
      }
    });
  }

  private async runWithUploadMutex<T>(task: () => Promise<T>): Promise<T> {
    const run = this.uploadQueue.then(async () => {
      this.isUploadingAttachments = true;
      try {
        return await task();
      } finally {
        this.isUploadingAttachments = false;
      }
    });
    this.uploadQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async uploadPendingAttachment(
    dbServ: SQLiteObject,
    params: UploadAttachmentParams,
  ): Promise<boolean> {
    if (localStorage.getItem('connected') !== 'true') {
      return false;
    }

    let idTransaction = Number(params.idTransaction ?? 0);
    if (idTransaction <= 0) {
      idTransaction = await this.resolveServerTransactionId(
        dbServ,
        params.coTransaction,
        params.naTransaction,
      );
      if (idTransaction <= 0) {
        console.warn('[AdjuntoService] Sin id de servidor para adjunto', params);
        return false;
      }
    }

    try {
      const fileContent = await Filesystem.readFile({
        path: params.naAttachment,
        directory: Directory.External,
      });
      const file = fileContent.data as string;
      const mimeType = this.getMIMEType(params.naAttachment) || undefined;

      await this.servicesServ.sendImage(
        params.naTransaction,
        idTransaction.toString(),
        params.position.toString(),
        file,
        params.naAttachment,
        params.type,
        params.cantidad,
        mimeType,
      );

      await this.deletePendingTransactionAttachmentsByKey(
        dbServ,
        params.coTransaction,
        params.naAttachment,
        params.type,
      );
      return true;
    } catch (error) {
      console.error('[AdjuntoService] uploadPendingAttachment failed', params, error);
      await this.recordUploadAttemptFailure(
        dbServ,
        params.coTransaction,
        params.naAttachment,
        params.type,
        error,
      );
      return false;
    }
  }

  async resolveServerTransactionId(
    dbServ: SQLiteObject,
    coTransaction: string,
    naTransaction: string,
  ): Promise<number> {
    const queryByModule: Record<string, { sql: string; column: string }> = {
      cobros: { sql: 'SELECT id_collection AS id FROM collections WHERE co_collection = ?', column: 'id' },
      pedidos: { sql: 'SELECT id_order AS id FROM orders WHERE co_order = ?', column: 'id' },
      visitas: { sql: 'SELECT id_visit AS id FROM visits WHERE co_visit = ?', column: 'id' },
      clientes: { sql: 'SELECT id_client AS id FROM potential_clients WHERE co_client = ?', column: 'id' },
      devoluciones: { sql: 'SELECT id_return AS id FROM returns WHERE co_return = ?', column: 'id' },
      inventarios: { sql: 'SELECT id_client_stock AS id FROM client_stocks WHERE co_client_stock = ?', column: 'id' },
      depositos: { sql: 'SELECT id_deposit AS id FROM deposits WHERE co_deposit = ?', column: 'id' },
    };

    const query = queryByModule[naTransaction];
    if (!query) {
      return 0;
    }

    try {
      const result = await dbServ.executeSql(query.sql, [coTransaction]);
      if (result.rows.length === 0) {
        return 0;
      }
      return Number(result.rows.item(0).id) || 0;
    } catch (e) {
      console.error('[AdjuntoService] resolveServerTransactionId error', e);
      return 0;
    }
  }

  private async recordUploadAttemptFailure(
    dbServ: SQLiteObject,
    coTransaction: string,
    naAttachment: string,
    type: string,
    error: unknown,
  ): Promise<void> {
    const message = String((error as Error)?.message ?? error ?? 'Error desconocido').slice(0, 200);
    try {
      await dbServ.executeSql(
        `UPDATE pending_transactions_attachments
         SET attempt_count = COALESCE(attempt_count, 0) + 1,
             last_attempt = ?,
             last_error = ?
         WHERE co_transaction = ? AND na_attachment = ? AND type = ?`,
        [new Date().toISOString(), message, coTransaction, naAttachment, type],
      );
    } catch (e) {
      console.warn('[AdjuntoService] recordUploadAttemptFailure skipped', e);
    }
  }

  getSavedPhotos(dbServ: SQLiteObject, co_transaction: string, na_transaction: string) {
    //Obtiene TODOS los adjuntos de un documento.
    //Usar para abrir documentos guardados o enviados
    this.moduleName = na_transaction;
    const loadTasks: Promise<void>[] = [];

    loadTasks.push(
      this.getImagesByTransaction(dbServ, co_transaction, na_transaction).then(data => {
        const imageTasks = data.map(item => {
          return Filesystem.readFile({
            path: item.naImage,
            directory: Directory.External,
          }).then(f => {
            const file = f.data as string;
            const muyPesado = this.getFileWeight(file) > this.imageWeightLimit;
            if (muyPesado) {
              this.weightLimitExceeded = true;
            }
            this.fotos.push(new Foto(item.naImage.split('.').pop() as string, file, item.naImage, muyPesado));
          }).catch(error => console.log(error));
        });
        return Promise.all(imageTasks).then(() => undefined);
      })
    );

    loadTasks.push(
      this.getSignatureByTransaction(dbServ, co_transaction, na_transaction).then(sign => {
        if (sign?.naImage) {
          return Filesystem.readFile({
            path: sign.naImage,
            directory: Directory.External,
          }).then(s => {
            this.firma = s.data as string;
          }).catch(error => console.log(error));
        }
        return undefined;
      })
    );

    loadTasks.push(
      this.getFileByTransaction(dbServ, co_transaction, na_transaction).then(adjuntos => {
        const fileTasks = adjuntos.map(adjunto => {
          const filename = adjunto.naFile;
          if (this.viewOnly) {
            this.files.push(new Archivo(this.getMIMEType(filename), '', filename));
            return Promise.resolve();
          }
          return Filesystem.readFile({
            path: filename,
            directory: Directory.External,
          }).then(f => {
            this.files.push(new Archivo(this.getMIMEType(filename), f.data as string, filename));
          }).catch(error => console.log(error));
        });
        return Promise.all(fileTasks).then(() => undefined);
      })
    );

    Promise.all(loadTasks).then(() => {
      this.attachmentsLoaded.next();
    });
  }

  getMIMEType(filename: string) {
    var type = filename.split('.').pop();
    if (type == undefined) {
      type = ''
    }
    switch (type.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
        break;

      case 'doc':
        return 'application/msword';
        break;

      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        break

      case 'xls':
        return 'application/vnd.ms-excel';
        break

      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break

      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
        break

      case 'png':
        return 'image/png';
        break

      case 'gif':
        return 'image/gif';
        break


      default:
        return ''
        break;
    }
  }


  getTags(dbServ: SQLiteObject) {
    if (this.tags.size > 0) {
      //ya tenemos los tags, no hay que hacer nada.
    } else {
      this.servicesServ.getTags(dbServ, "ADJ", "ESP").then(result => {
        for (var i = 0; i < result.length; i++) {
          this.tags.set(
            result[i].coApplicationTag, result[i].tag
          )
        }
      });
      this.servicesServ.getTags(dbServ, "DEN", "ESP").then(result => {
        for (var i = 0; i < result.length; i++) {
          this.tags.set(
            result[i].coApplicationTag, result[i].tag
          )
        }
      });
    }
  }


  getQuantityAdjuntos() {
    return Promise.resolve(this.fotos.length + this.files.length + (this.firma != "" ? 1 : 0))
  }

  deletePendingTransactionAttachments(dbServ: SQLiteObject, idTransaction: number, position: number, type: string, naTransaction: string) {
    console.log("ESTA FOTO SE ENVIO ", idTransaction, position, type, naTransaction, "SE ELIMINA DE LA TABLA DE ADJUNTOS PENDIENTES");
    return dbServ.executeSql(
      'DELETE FROM pending_transactions_attachments WHERE id_transaction = ? AND position = ? AND type = ? AND na_transaction = ?;',
      [idTransaction, position, type, naTransaction]
    ).then(() => {
      return true;
    }).catch(e => {
      console.error('[AdjuntoService] deletePendingTransactionAttachments error', e);
      return false;
    });
  }

  deletePendingTransactionAttachmentsByKey(
    dbServ: SQLiteObject,
    coTransaction: string,
    naAttachment: string,
    type: string,
  ): Promise<boolean> {
    return dbServ.executeSql(
      'DELETE FROM pending_transactions_attachments WHERE co_transaction = ? AND na_attachment = ? AND type = ?;',
      [coTransaction, naAttachment, type],
    ).then(() => true).catch(e => {
      console.error('[AdjuntoService] deletePendingTransactionAttachmentsByKey error', e);
      return false;
    });
  }

}

interface UploadAttachmentParams {
  naTransaction: string;
  idTransaction: number;
  coTransaction: string;
  naAttachment: string;
  type: string;
  position: number;
  cantidad: number;
}
