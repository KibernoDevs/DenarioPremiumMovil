import { Component, ElementRef, OnInit, ViewChild, Input, Output, inject, EventEmitter, Renderer2, AfterViewInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

import { IonModal } from '@ionic/angular';
import { OverlayEventDetail } from '@ionic/core/components';

import { Coordinate } from 'src/app/modelos/coordinate';
import { MessageAlert } from 'src/app/modelos/tables/messageAlert';
import { PendingTransaction } from 'src/app/modelos/tables/pendingTransactions';
import { AutoSendService } from 'src/app/services/autoSend/auto-send.service';
import { ClientLogicService } from 'src/app/services/clientes/client-logic.service';
import { ClientLocationService } from 'src/app/services/clientes/locationClient/client-location.service';
import { GeolocationService } from 'src/app/services/geolocation/geolocation.service';
import { MessageService } from 'src/app/services/messageService/message.service';
import { ServicesService } from 'src/app/services/services.service';
import { SynchronizationDBService } from 'src/app/services/synchronization/synchronization-db.service';
import { API_KEY_GOOGLE_MAPS } from 'src/app/utils/appConstants';
import { GoogleMap } from '@angular/google-maps';

@Component({
  selector: 'app-client-location',
  templateUrl: './client-location.component.html',
  styleUrls: ['./client-location.component.scss'],
  standalone: false
})
export class ClientLocationComponent implements OnInit {

  public messageAlert!: MessageAlert;
  private messageService = inject(MessageService);
  private services = inject(ServicesService);
  private synchronizationServices = inject(SynchronizationDBService);
  private autoSend = inject(AutoSendService);
  public clientLogic = inject(ClientLogicService);
  public subs: any;
  public coordinateClient!: Coordinate;
  public newMap!: GoogleMap;
  public marker!: string;
  /* public coordenadas: string = ""; */
  public locationService = inject(ClientLocationService);
  public booleanMsj: Boolean = false;
  public selectedLatitude!: number;
  public selectedLogitude!: number;
  public isValidCoordinate: Boolean = true;
  public disableMap: Boolean = false;
  public coordenadaInicial: string = "";

  mapCenter: google.maps.LatLngLiteral = { lat: 10.48801, lng: -66.87919 }; //por defecto ponemos caracas
  redMarker: google.maps.LatLngLiteral = { lat: 10.48801, lng: -66.87919 };

  mapOptions: google.maps.MapOptions = {
    zoom: 15,
    fullscreenControl: false,
    mapTypeControl: false,
    streetViewControl: false,
  }

  public regexLatitude = new RegExp(/^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,30}/);
  /* public regexLongitude = new RegExp(/^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,6}/); */
  public regexLongitude = new RegExp(/^-?([0-9]{1,2}|1[0-7][0-9]|180)\.{1}\d{1,30}/);

  moveMap(event: google.maps.MapMouseEvent) {
    if (this.disableMap) {
      //si el mapa esta deshabilitado no hago nada
      console.log("mapa deshabilitado");
      this.clientLogic.clientLocationChanged = false;
      return;
    }
    if (event.latLng !== null) {
      this.redMarker = event.latLng.toJSON();
      this.selectedLatitude = Number(this.redMarker.lat.toFixed(7));
      this.selectedLogitude = Number(this.redMarker.lng.toFixed(7));

      this.setLocation();

      if (this.clientLogic.nameModule == "potentialClient")
        this.clientLogic.clientLocationChanged = false;
      else
        this.clientLogic.clientLocationChanged = true;
      this.clientLogic.cannotSendClientCoordinate = false; //INHABILITO BOTYON DE ENVIAR

    }
  }

  addMarker(xy: Coordinate) {

    this.redMarker = {
      lat: xy.lat,
      lng: xy.lng,
    }

    this.mapCenter = {
      lat: xy.lat,
      lng: xy.lng,
    }

    this.selectedLatitude = xy.lat;
    this.selectedLogitude = xy.lng;

    //this.clientLogic.clientLocationChanged = true;
    //this.clientLogic.cannotSendClientCoordinate = false; //INHABILITO BOTYON DE ENVIAR

    //this.setLocation();

    if (this.clientLogic.nameModule == "potentialClient") {
      this.clientLogic.clientLocationChanged = false;
      this.clientLogic.potentialClient.coordenada = this.coordenadaInicial;
      this.clientLogic.potentialClient.coordenadaClient = this.selectedLatitude + "," + this.selectedLogitude;
    }

  }

  public clientLocationForm = new FormGroup({
    latitude: new FormControl('', [Validators.required,
    Validators.pattern((/^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,30}/))]),
    longitude: new FormControl('', [Validators.required,
    Validators.pattern((/^-?([0-9]{1,2}|1[0-7][0-9]|180)(\.[0-9]{1,30})?$/))]),
    /* Validators.pattern((/^-?([1-8]?[1-9]|[1-9]0)\.{1}\d{1,6}/))]), */
  });



  //@ViewChild('mapClient')
  mapClient() {
    this.messageService.showLoading().then(() => {
      this.geoServ.getCurrentPosition().then(coords => {
        let pos = this.geoServ.getLatestPosition();

        this.coordinateClient = {} as Coordinate;
        this.coordinateClient.coUserAddressClient = new Date().getTime().toString();
        this.coordinateClient.idUserAddressClient = 0;

        if (this.clientLogic.coordenada.lat == 0 && this.clientLogic.coordenada.lng == 0) {
          this.selectedLatitude = pos.coords.latitude;
          this.selectedLogitude = pos.coords.longitude;
          this.coordinateClient.lat = Number(this.selectedLatitude);
          this.coordinateClient.lng = Number(this.selectedLogitude);

        } else if (this.regexLatitude.exec(this.clientLogic.coordenada.lat.toString())
          && this.regexLongitude.exec(this.clientLogic.coordenada.lng.toString())) {
          this.selectedLatitude = this.clientLogic.coordenada.lat;
          this.selectedLogitude = this.clientLogic.coordenada.lng;
          this.coordinateClient.lat = this.clientLogic.coordenada.lat;
          this.coordinateClient.lng = this.clientLogic.coordenada.lng;
        } else {
          this.selectedLatitude = Number(coords.split(",")[0]);
          this.selectedLogitude = Number(coords.split(",")[1]);
          this.coordinateClient.lat = Number(this.selectedLatitude);
          this.coordinateClient.lng = Number(this.selectedLogitude);
        }

        this.coordenadaInicial = this.selectedLatitude + "," + this.selectedLogitude;
        this.addMarker(this.coordinateClient);

        this.messageService.hideLoading();
        //this.createMap(ref.nativeElement);
      });

    })
  }


  constructor(
    private geoServ: GeolocationService,
    private renderer: Renderer2,

  ) { }

  ngOnInit() {

    /* let element: HTMLElement = document.getElementById('probando') as HTMLElement;
    element.click(); */
    this.clientLocationForm.markAllAsTouched();
    this.saveLocation();
    this.booleanMsj = false;
    //this.clientLogic.cannotSendClientCoordinate = false;
    this.disableMap = this.clientLogic.coordenada.editable ? false : true;
    this.clientLogic.cannotSendClientCoordinate = this.disableMap;
    if (this.disableMap) {
      this.clientLogic.clientLocationChanged = false;
    }


    /*
    this.geoServ.getCurrentPosition().then(xy => {
      let pos = this.geoServ.getLatestPosition();
      this.mapCenter = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }
      this.redMarker = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }
      this.selectedLatitude = pos.coords.latitude;
      this.selectedLogitude = pos.coords.longitude;
    })
*/
    this.mapClient();
  }





  ngOnDestroy() {
    //this.newMap.destroy();
    this.subs.unsubscribe();
  }
  /*
    async createMap(ref: HTMLElement) {
      this.newMap = await GoogleMap.create({
        id: 'my-map', // Unique identifier for this map instance
        element: ref, // reference to the capacitor-google-map element
        apiKey: API_KEY_GOOGLE_MAPS, // Your Google Maps API Key
        config: {
          center: {
            // The initial position to be rendered by the map
            lat: this.coordinateClient.lat,
            lng: this.coordinateClient.lng,
          },
          zoom: 14, // The initial zoom level to be rendered by the map
        },
        forceCreate: true,
      })
      this.addMarker(this.coordinateClient).then(resp => {
        this.colocarPingClick();
      });
  
    }
      */

  /*
  destroy() {
    this.locationService.destruirmapa = true;
    return this.newMap.destroy();
  }
    */


  /*
  async colocarPingClick() {
    this.messageService.hideLoading();
    if (this.clientLogic.datos.client.editable == "true") {
      await this.newMap.setOnMapClickListener((coordenadas) => {
        this.removeMarker().then(resp => {
          this.coordinateClient.lat = coordenadas.latitude;
          this.coordinateClient.lng = coordenadas.longitude;
          this.addMarker(this.coordinateClient);
        })

      });
    } else {
      this.messageAlert = new MessageAlert(
        "Denario Cliente",
        "No esta permitido actualizar la ubicacion de este cliente"
      );
      this.messageService.alertModal(this.messageAlert);
    }

  }
    */


  saveLocation() {
    this.subs = this.locationService.salvarGuardarLocacion.subscribe(() => {
      this.messageService.showLoading().then(() => {
        this.coordinateClient.idClient = this.clientLogic.coordenada.idClient;
        this.coordinateClient.idAddressClients = this.clientLogic.coordenada.idAddressClients;
        this.coordinateClient.coAddressClients = this.clientLogic.coordenada.coAddressClients;
        this.coordinateClient.idEnterprise = this.clientLogic.coordenada.idEnterprise;
        this.coordinateClient.txComment = "cambiando coordenada cliente";

        this.clientLogic.datos.client.coordenada = this.selectedLatitude + "," + this.selectedLogitude;
        this.locationService.insertUserAddressClient(this.coordinateClient).then((result) => {
          console.log("se actualizo la coordenada");
          /*        this.messageAlert = new MessageAlert(
                   "Denario Cliente",
                   "¡Coordenada actualizada con exito!"
                 );
                 this.messageService.alertModal(this.messageAlert); */
          let pendingTransaction = {} as PendingTransaction;
          pendingTransaction.coTransaction = this.coordinateClient.coUserAddressClient;
          pendingTransaction.idTransaction = this.coordinateClient.idUserAddressClient;
          pendingTransaction.type = "updateaddress";
          if (localStorage.getItem("connected") == "true") {
            /*
            this.messageAlert = new MessageAlert(
              "Denario Cliente",
              "¡La nueva coordenada sera enviada!"
            );
            this.messageService.alertModal(this.messageAlert);
            */
            //this.messageService.transaccionMsjModalNB("¡La nueva coordenada sera enviada!");

            this.services.insertPendingTransaction(this.synchronizationServices.getDatabase(), pendingTransaction).then(result => {
              if (result) {
                void this.autoSend.runPendingQueue();
                this.clientLogic.showBackRoute('clientLocationComponent');
              }
              this.messageService.hideLoading();
            })
          } else {
            this.messageService.hideLoading();
            /*
            this.messageAlert = new MessageAlert(
              "Denario Cliente",
              "¡La nueva coordenada sera enviada al tener conexión de datos!"
            );
            this.messageService.alertModal(this.messageAlert);
            */
            //this.messageService.transaccionMsjModalNB("¡La nueva coordenada sera enviada al tener conexión de datos!");
          }
        });
      });

    })
  }
  setCoordenada(coordenada: any) {
    console.log("BOTON ACEPTAR EN ACCORDION ", coordenada)
    /*     this.clientLocationForm.markAllAsTouched(); */
    this.setLocation();
  }

  async setLocation() {

    let date = new Date();
    this.coordinateClient.coUserAddressClient = date.getTime().toString();
    this.coordinateClient.idUserAddressClient = 0;

    if (this.clientLogic.nameModule == "potentialClient") {
      this.clientLogic.clientLocationChanged = false;
      this.clientLogic.potentialClient.coordenada = this.coordenadaInicial;
      this.clientLogic.potentialClient.coordenadaClient = this.selectedLatitude + "," + this.selectedLogitude;
    } else {
      this.clientLogic.coordenada.lat = this.selectedLatitude;
      this.clientLogic.coordenada.lng = this.selectedLogitude;
    }
    
    this.coordinateClient.lat = this.selectedLatitude;
    this.coordinateClient.lng = this.selectedLogitude;



    //this.addMarker(this.coordinateClient);
  }

  validateCoordinate(coordenadas: FormGroup) {
    let error = 0;
    let text = "";
    let notError = true;
    let latitude = this.selectedLatitude;
    let longitude = this.selectedLogitude;

    if (latitude == null || longitude == null) {
      error = 1;
      notError = false;
    } else {
      if (!this.regexLatitude.exec(latitude.toString()) || Math.abs(latitude) > 90) {
        notError = false;
        console.log("latitud incorrecta");
        error = 2;

      } else if (!this.regexLongitude.exec(longitude.toString()) || Math.abs(longitude) > 180) {
        notError = false;
        console.log("longitud incorrecta");
        error = 3;
      }
    }
    if (notError) {
      this.setLocation();
    } else {
      switch (error) {
        case 1: {
          text = "¡La latitud y/o longitud no pueden ser vacias!"
          break;
        }
        case 2: {
          text = "¡La latitud debe estar entre -90 y 90!"
          break;
        }
        case 3: {
          text = "¡La longitud debe estar entre -180 y 180!"
          break;
        }
        default: {
          text = "Error"
        }
      }
      this.clientLogic.cannotSendClientCoordinate = true; //INHABILITO BOTYON DE ENVIAR
      this.clientLogic.clientLocationChanged = false; //CAMBIO STATUS BOTON ATRAS
      this.selectedLatitude = this.coordinateClient.lat;
      this.selectedLogitude = this.coordinateClient.lng;
      this.messageAlert = new MessageAlert(
        "Denario Cliente",
        text
      );
      this.messageService.alertModal(this.messageAlert)
    }
  }

  get getLatitude() { return this.clientLocationForm.controls['latitude']; }
  get getLongitude() { return this.clientLocationForm.controls['longitude']; }

}