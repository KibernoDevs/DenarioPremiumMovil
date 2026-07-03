import { Component, OnInit, inject } from '@angular/core';
import { App } from '@capacitor/app';
import { Platform } from '@ionic/angular';

import { ServicesService } from '../services/services.service';
import { FormControl, FormGroup } from '@angular/forms';
import { NavController } from '@ionic/angular';
import { PluginListenerHandle } from '@capacitor/core';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { Device } from '@capacitor/device';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';

import { User } from '../modelos/user';
import { SynchronizationDBService } from '../services/synchronization/synchronization-db.service';
import { Login } from '../modelos/login';
import { MessageService } from 'src/app/services/messageService/message.service';
import { MessageAlert } from '../modelos/tables/messageAlert';
import { LoginLogicService } from '../services/login/login-logic.service';
import { ImageServicesService } from '../services/imageServices/image-services.service';
import { Imagenes } from '../modelos/imagenes';
import { ScreenOrientation, OrientationType } from '@capawesome/capacitor-screen-orientation';
import { Keyboard } from '@capacitor/keyboard';
import { from } from 'rxjs';
import { firstValueFrom } from 'rxjs';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: false
})
export class LoginComponent implements OnInit {
  public loginLogic = inject(LoginLogicService);


  private synchronization = inject(SynchronizationDBService);
  private globalConfig = inject(GlobalConfigService);
  private services = inject(ServicesService);
  private message = inject(MessageService);

  public database!: SQLiteObject;
  public db!: SQLite;
  private user!: User;
  private deviceInfo!: {};
  private deviceId!: {};
  public isAlertOpen = false;
  public errorMsj = "";
  public alertButtons = ['OK'];
  public showPassword = true;
  public loginDetail!: Login;
  public login!: string;
  public password!: string;
  public messageAlert!: MessageAlert;
  public versionApp!: string;
  public subs: any;
  public subsChangeUser: any;
  public fechaCreacion: string = "2000-01-01 00:00:00";
  public downloadFileList: Imagenes[] = [];
  public removeFileList: Imagenes[] = [];
  public listFilesImages: string[] = [];
  public networkListener!: PluginListenerHandle;
  public isIOS: boolean = false; // <-- NUEVA PROPIEDAD
  public showFooter: boolean = true; // <-- NUEVA PROPIEDAD
  public currentYear: number = new Date().getFullYear();

  private static readonly FALLBACK_VERSION = '6.6.18';

  async ngOnInit() {
    this.versionApp = await this.resolveAppVersion();

    if (localStorage.getItem("tokenExpired") === "true") {
      localStorage.removeItem("tokenExpired");
      localStorage.removeItem("token");
      this.messageAlert = new MessageAlert(
        "Denario Premium",
        "Tu sesión expiró. Vuelve a iniciar sesión para continuar sincronizando."
      );
      this.message.alertModal(this.messageAlert);
    }

    const storedVersionApp = localStorage.getItem("versionApp");
    // primer arranque: guardamos la versionApp actual
    if (!storedVersionApp) {
      localStorage.setItem("versionApp", this.versionApp);
      await this.initLogin();
    } else {
      // si la semver actual es mayor que la guardada --> ejecutar limpieza/sincronización
      if (this.compareSemVer(this.versionApp, storedVersionApp) > 0) {
        try {
          const createTables$ = await this.synchronization.getCreateTables();
          createTables$.subscribe(async (createTablesRes) => {
            //this.loginLogic.dropTables(createTablesRes).then((dropRes: any) => {
            // limpia y vuelve a dejar guardada la nueva versiónApp
            let connected = localStorage.getItem("connected");
            let connectionType = localStorage.getItem("connectionType");
            //await this.synchronization.checkAndRunMigrations();
            //localStorage.clear();
            localStorage.setItem("versionApp", this.versionApp);
            localStorage.setItem("connected", String(connected));
            localStorage.setItem("connectionType", String(connectionType));

            this.initLogin();
            /* }).catch(err => {
              console.error('dropTables error', err);
            }); */
          }, (err: any) => {
            console.error('getCreateTables subscribe error', err);
          });
        } catch (err) {
          console.error('Error al obtener createTables para sincronizar', err);
        }
      } else {
        await this.initLogin();
      }
    }

  }

  async initLogin() {
    this.loginDetail = {} as Login;
    if (localStorage.getItem("recuerdame") == "true") {
      this.loginDetail.login = localStorage.getItem("login")!;
      this.loginDetail.password = localStorage.getItem("password")!;
      this.loginDetail.recuerdame = true;
    }

    //si comentan esta lineas se desbloquea la orientacion del telefono
    //window.screen.orientation.lock('portrait') //ya no funciona

    ScreenOrientation.lock({ type: OrientationType.PORTRAIT });

    //subcripcion por si cambian el usuario
    this.subsChangeUser = this.loginLogic.changeUser.subscribe(async (data: Boolean) => {
      //SI LE DAN A ACEPTAR, HAY QUE BORRAR LA BD, GUARDAR EN LOCALSTORAGE EL NUEVO LOGIN Y PASS,
      //Y SINCRONIZAR CON LOS NUEVOS DATOS
      console.log(data);
      let f = this.loginForm;
      localStorage.setItem("login", f.value.login.trim());
      localStorage.setItem("password", f.value.password);

      try {
        const createTables$ = await this.synchronization.getCreateTables();
        const tables = await firstValueFrom(createTables$);

        await this.loginLogic.dropTables(tables);
        // Las migraciones deben correr luego de recrear tablas en initDb/createTables.
        // Reiniciamos la versión para forzar su ejecución en el flujo correcto.
        localStorage.removeItem("db_version");

        console.log('Cambio de usuario: tablas eliminadas. Migraciones pendientes al recrear BD.');
        console.log(f);
        localStorage.removeItem("lastUpdate");
        this.validateConnection(f);
      } catch (e) {
        console.error('Error durante cambio de usuario (drop/migrations):', e);
        this.message.hideLoading();
        this.messageAlert = new MessageAlert(
          "Denario Premium",
          "No se pudo completar la preparación de base de datos para el cambio de usuario. Intente nuevamente."
        );
        this.message.alertModal(this.messageAlert);
      }
    })

    this.deviceInfo = await Device.getInfo();
    this.deviceId = await Device.getId();
    //console.log(this.deviceInfo, this.deviceId);
    this.isIOS = this.platform.is('ios'); // <-- DETECTA SI ES iOS

    Keyboard.addListener('keyboardWillShow', () => {
      this.showFooter = false;
    });
    Keyboard.addListener('keyboardWillHide', () => {
      this.showFooter = true;
    });
  }

  ngOnDestroy() {
    this.subs.unsubscribe()
    this.subsChangeUser.unsubscribe()
  }

  constructor(
    private navController: NavController,
    private sqlite: SQLite,
    private platform: Platform
  ) { }

  loginForm = new FormGroup({
    login: new FormControl(),
    password: new FormControl(),
    recuerdame: new FormControl(),
  });

  /* validateConnection(f: NgForm) { */
  validateConnection(f: FormGroup) {
    this.message.showLoading().then(() => {

      if (localStorage.getItem("connectionType") == "wifi" || localStorage.getItem("connectionType") == "cellular") {
        //HAY CONEXION
        this.onLogin(f, this.deviceInfo, this.deviceId, true);
      } else if (localStorage.getItem("lastUpdate") != null && localStorage.getItem("lastUpdate") != "2000-01-01 00:00:00.000") {
        this.onLogin(f, this.deviceInfo, this.deviceId, false);

      } else {
        this.messageAlert = new MessageAlert(
          "Denario Premium",
          "Debe conectarse el celular a una red Wifi o señal de datos"
        );
        this.message.alertModal(this.messageAlert);
      }
    });

  }

  onLogin(f: FormGroup, deviceInfo: {}, deviceId: {}, conexion: boolean) {
    let login = "";
    //conexion = false; //descomentar para probar sin conexion
    if (f.value.login != undefined) {
      login = f.value.login.trim();
    }
    if (login == "" || f.value.password == "" || login == undefined || f.value.password == undefined) {
      this.message.hideLoading();
      this.messageAlert = new MessageAlert(
        "Denario Premium",
        "Usuario y/o password no pueden ser vacios"
      );
      /* this.message.hideLoading(); */
      this.message.alertModal(this.messageAlert);
    } else if (localStorage.getItem("login") != login && localStorage.getItem("login") != null) {
      this.message.hideLoading();
      this.messageAlert = new MessageAlert(
        "Denario Premium",
        "Está intentando sincronizar con un usuario que es diferente al previamente ingresado," +
        " de aceptar la sincronización todos los datos anteriores serán borrados. ¿Está de acuerdo?"
      );

      this.message.alertModalModule(this.messageAlert, "login");


    } else if (conexion) {
      this.subs = from(this.services.onLogin(f.value, deviceInfo, deviceId)).subscribe({
        next: (result) => {
          switch (result.data.errorCode) {
            case '000':
              if (localStorage.getItem("recuerdame") == "true") {

                localStorage.setItem("password", f.value.password);
              } else {

                localStorage.removeItem("password");
              }

              localStorage.setItem("login", login);
              localStorage.setItem("token", result.data.jwtAuthResponse.tokenDeAcceso);
              localStorage.setItem("lastUpdate", result.data.lastUpdate);
              if (result.data.cliente)
                this.globalConfig.setVars(result.data.variablesConfiguracionCliente)
              else
                this.globalConfig.setVars(result.data.variablesConfiguracion)

              //localStorage.setItem("globalConfiguration", JSON.stringify(result.variablesConfiguracion));
              localStorage.setItem("idUser", result.data.idUser.toString());
              localStorage.setItem("coUser", result.data.coUser);
              this.user = result.data;
              localStorage.setItem("user", JSON.stringify(this.user));
              this.synchronization.initDb(this.user, conexion);
              break;
            case '104':
              this.message.hideLoading();
              this.messageAlert = new MessageAlert(
                "Denario Premium",
                "Usuario y/o contraseña incorrectos."
              );
              this.message.alertModal(this.messageAlert);
              break;
            case '403':
              let msj = "";
              if (result.data.errorMessage != null && result.data.errorMessage != undefined)
                msj = result.data.errorMessage;
              else
                msj = "Acceso no autorizado. Por favor, contacte al administrador.";

              this.message.hideLoading();
              this.messageAlert = new MessageAlert(
                "Denario Premium",
                msj
              );
              this.message.alertModal(this.messageAlert);
              break;
            default: {
              this.message.hideLoading();
              this.messageAlert = new MessageAlert(
                "Denario Premium",
                "Ocurrió un error de comunicación con el servidor, verifique cobertura e intente nuevamente."
              );
              this.message.alertModal(this.messageAlert);
            }
          }

        },
        complete: () => {
          console.info('complete')
        },
        error: (e) => {
          this.message.hideLoading();

          this.messageAlert = new MessageAlert(
            "Denario Premium",
            "Ocurrió un error de comunicación con el servidor, verifique cobertura e intente nuevamente."
          );
          this.message.alertModal(this.messageAlert);
          /*           this.message.hideLoading();
           */
          console.error(e);
        },
      })
    } else {
      if (localStorage.getItem("recuerdame") == "true") {
        localStorage.setItem("login", login);
        localStorage.setItem("password", f.value.password);
      } else {

        localStorage.removeItem("password");
      }
      let user = {} as User;
      this.globalConfig.setVars([]);
      this.synchronization.initDb(user, conexion);
/*       this.message.hideLoading();
 */    }
  }

  exitApp() {
    /*  this.navController.navigateForward("login"); */
    App.exitApp();
  }

  openDb() {
    this.db = new SQLite();
    this.sqlite.create({
      name: 'denarioPremium',
      location: 'default'
    }).then((db: SQLiteObject) => {
      this.database = db;

    }).catch(e => console.log(e));
  }

  setOpen(isOpen: boolean) {
    this.isAlertOpen = isOpen;
  }

  checked(event: any, f: FormGroup) {
    if (event) {
      /*  localStorage.setItem("login", login);
       localStorage.setItem("password", f.value.password); */
      localStorage.setItem("recuerdame", "true");
    } else {
      if (localStorage.getItem("recuerdame") == "true" && localStorage.getItem("recuerdame") != "null" && localStorage.getItem("recuerdame") != null) {

        /* localStorage.removeItem("login");
        localStorage.removeItem("password"); */
        localStorage.removeItem("recuerdame");
      }
    }
  }

  private async resolveAppVersion(): Promise<string> {
    try {
      const info = await App.getInfo();
      return info.version?.trim() || LoginComponent.FALLBACK_VERSION;
    } catch {
      return LoginComponent.FALLBACK_VERSION;
    }
  }

  // Comparador semver: devuelve 1 si a>b, -1 si a<b, 0 si iguales
  private compareSemVer(a?: string, b?: string): number {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    const pa = a.split('.').map(x => parseInt(x, 10) || 0);
    const pb = b.split('.').map(x => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = pa[i] ?? 0;
      const nb = pb[i] ?? 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

}
