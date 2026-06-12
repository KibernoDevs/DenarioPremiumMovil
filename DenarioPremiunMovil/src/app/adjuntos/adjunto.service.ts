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

  public config = inject(GlobalConfigService);

  public servicesServ = inject(ServicesService);

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
      batch.push([saveTransacctionImages, [this.files[j].naFile, 0, coTransaction, "file", naTransaction, 0]]);
    }


    dbServ.sqlBatch(batch).then(result => {
      console.log(result);
    }).catch(error => {
      console.log(error);
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

    for (var i = 0; i < pendingTransactionsAttachments.length; i++) {
      let item = pendingTransactionsAttachments[i];
      switch (pendingTransactionsAttachments[i].type) {
        case 'attach':
          var file: string;
          try {
            Filesystem.readFile({
              path: item.naAttachment,
              directory: Directory.External,
            }).then(f => {
              file = f.data as string;

              this.servicesServ.sendImage(item.naTransaction, item.idTransaction.toString(), item.position.toString(), file, item.naAttachment, 'attach', item.cantidad!).then((resp) => {
                console.log(resp);
                let idTransaction = resp.name.split('_')[0];
                let position = resp.name.split('_')[1].split(".")[0]
                let type = resp.type;
                let naTransaction = resp.transaction;
                this.deletePendingTransactionAttachments(dbServ, idTransaction, position, type, naTransaction)
              })

            }).catch((error) => { console.log(error) });
            break;
          } catch (e) {
            console.log(e);
            break;
          }
        case 'signature':
          var file: string;
          try {
            Filesystem.readFile({
              path: item.naAttachment,
              directory: Directory.External,
            }).then(f => {
              file = f.data as string;

              this.servicesServ.sendImage(item.naTransaction, item.idTransaction.toString(), item.position.toString(), file, item.naAttachment, 'signature', item.cantidad - 1).then((resp) => {
                let idTransaction = resp.name.split('_')[0];
                let position = resp.name.split('_')[1].split(".")[0];
                let type = resp.type;
                let naTransaction = resp.transaction;
                this.deletePendingTransactionAttachments(dbServ, idTransaction, position, type, naTransaction)
              })

            }).catch((error) => { console.log(error) });
          } catch (e) {
            console.log(e);
          }
          break;
        case 'file':
          var file: string;
          try {
            Filesystem.readFile({
              path: item.naAttachment,
              directory: Directory.External,
            }).then(f => {
              file = f.data as string;

              this.servicesServ.sendImage(item.naTransaction, item.idTransaction.toString(), item.position.toString(), file, item.naAttachment, 'file', item.cantidad!).then((resp) => {
                let idTransaction = resp.name.split('_')[0];
                let position = resp.name.split('_')[1].split(".")[0]
                let type = resp.type;
                let naTransaction = resp.transaction;
                this.deletePendingTransactionAttachments(dbServ, idTransaction, position, type, naTransaction)
              })

            }).catch((error) => { console.log(error) });
          } catch (e) {
            console.log(e);
          }
          break;
      }
    }
  }

  async sendPhotos(dbServ: SQLiteObject, idTransaction: number, naTransaction: string, coTransaction: string) {

    let cantidad: number = 0;
    let cantidadFotos: number = 0;
    return this.getNuAttachImages(dbServ, coTransaction, naTransaction).then(nuAttachImages => {

      cantidad = nuAttachImages;

      var retrieveStatement = "SELECT id_transaction_image as idTransactionImage," +
        "co_transaction as coTransaction, " +
        "na_transaction as naTransaction, " +
        "na_image as naImage from transaction_images " +
        "WHERE na_transaction = ? and co_transaction = ? ";

      return dbServ.executeSql(retrieveStatement, [naTransaction, coTransaction]).then(data => {
        console.log("[AdjuntoService] Enviando fotos");

        for (let i = 0; i < data.rows.length; i++) {
          const item: TransactionImage = data.rows.item(i);
          var file: string;
          try {
            Filesystem.readFile({
              path: item.naImage,
              directory: Directory.External,
            }).then(f => {
              file = f.data as string;

              this.servicesServ.sendImage(naTransaction, idTransaction.toString(), i.toString(), file, item.naImage, 'attach', cantidad).then((resp) => {
                console.log(resp);
                let idTransaction = resp.name.split('_')[0];
                let position = resp.name.split('_')[1].split(".")[0]
                let type = resp.type;
                let naTransaction = resp.transaction;
                this.deletePendingTransactionAttachments(dbServ, idTransaction, position, type, naTransaction)
              })


            }).catch((error) => { console.log(error) });
          } catch (e) {
            console.log(e);
          }

        }
        //firma
        var retrieveStatement = "SELECT id_transaction_signature as idTransactionSignature," +
          "co_transaction as coTransaction, " +
          "na_transaction as naTransaction, " +
          "na_image as naImage from transaction_signatures " +
          "WHERE na_transaction = ? and co_transaction = ? ";
        dbServ.executeSql(retrieveStatement, [naTransaction, coTransaction]).then(data => {
          console.log("[AdjuntoService] Enviando firma");
          var file: string;
          const item: TransactionSignature = data.rows.item(0);
          if (data.rows.length > 0) {
            try {
              Filesystem.readFile({
                path: item.naImage,
                directory: Directory.External,
              }).then(f => {
                file = f.data as string;

                this.servicesServ.sendImage(naTransaction, idTransaction.toString(), '0', file, item.naImage, 'signature', cantidad).then((resp) => {
                  let idTransaction = resp.name.split('_')[0];
                  let position = resp.name.split('_')[1].split(".")[0];
                  let type = resp.type;
                  let naTransaction = resp.transaction;
                  this.deletePendingTransactionAttachments(dbServ, idTransaction, position, type, naTransaction)
                })

              }).catch((error) => { console.log(error) });
            } catch (e) {
              console.log(e);
            }
          }
        });

        //Archivos
        var retrieveStatement = "SELECT id_transaction_files as idTransactionFile," +
          "co_transaction as coTransaction, " +
          "na_transaction as naTransaction, " +
          "na_file as naFile from transaction_files " +
          "WHERE na_transaction = ? and co_transaction = ? ";
        dbServ.executeSql(retrieveStatement, [naTransaction, coTransaction]).then(data => {
          console.log("[AdjuntoService] Enviando archivo");
          var file: string;
          for (let i = 0; i < data.rows.length; i++) {
          const item: TransactionFile = data.rows.item(i);
          if (data.rows.length > 0) {
            try {
              Filesystem.readFile({
                path: item.naFile,
                directory: Directory.External,
              }).then(f => {
                file = f.data as string;

                this.servicesServ.sendImage(naTransaction, idTransaction.toString(), i.toString(), file, item.naFile, 'file', cantidad).then((resp) => {
                  let idTransaction = resp.name.split('_')[0];
                  let position = resp.name.split('_')[1].split(".")[0]
                  let type = resp.type;
                  let naTransaction = resp.transaction;

                  this.deletePendingTransactionAttachments(dbServ, idTransaction, position, type, naTransaction)
                })
              

              }).catch((error) => { console.log(error) });
            } catch (e) {
              console.log(e);
            }
          }
        }
        });


      })
    })
  }

  getSavedPhotos(dbServ: SQLiteObject, co_transaction: string, na_transaction: string) {
    //Obtiene TODOS los adjuntos de un documento.
    //Usar para abrir documentos guardados o enviados
    this.moduleName = na_transaction;
    this.getImagesByTransaction(dbServ, co_transaction, na_transaction).then(data => {
      //console.log(data);
      for (let i = 0; i < data.length; i++) {
        var file: string;
        var item = data[i];
        try {
          Filesystem.readFile({
            path: item.naImage,
            directory: Directory.External,
          }).then(f => {
            file = f.data as string;
            var muyPesado = this.getFileWeight(file) > this.imageWeightLimit;
            if (muyPesado) {
              this.weightLimitExceeded = true;
            }
            let foto = new Foto(item.naImage.split('.').pop() as string, file, item.naImage, muyPesado);
            this.fotos.push(foto);


          });
        } catch (error) {
          console.log(error);
        }
      }
    });
    this.getSignatureByTransaction(dbServ, co_transaction, na_transaction).then(sign => {
      //console.log(sign);
      //var signData: string;
      if (sign != undefined && sign.naImage != null && sign.naImage !== '')
        try {
          Filesystem.readFile({
            path: sign.naImage,
            directory: Directory.External,
          }).then(s => {
            this.firma = s.data as string;
            //console.log('firma ='+ this.firma);

          })
        } catch (error) {
          console.log(error);
        }
    })
    this.getFileByTransaction(dbServ, co_transaction, na_transaction).then(adjuntos => {
      for (let i = 0; i < adjuntos.length; i++) {
        //chequear el tipo MIME de archivo para enviarlo
        var filename = adjuntos[i].naFile;
        if(this.viewOnly){
          //no hace falta cargar el archivo si solo se va a visualizar,
          //  con el nombre es suficiente para mostrar el adjunto.
          this.files.push(new Archivo(
            this.getMIMEType(filename),
            "",
            filename
          ));
        }else{
        try {
          Filesystem.readFile({
            path: filename,
            directory: Directory.External,
          }).then(f => {
            this.files.push(new Archivo(
              this.getMIMEType(filename),
              f.data as string,
              filename
            ));
          })
        } catch (error) {
          console.log(error);
        }
      }
      console.log(this.files);
    }
    })
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

}
