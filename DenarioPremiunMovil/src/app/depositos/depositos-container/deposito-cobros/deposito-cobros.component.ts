import { Component, inject, OnInit } from '@angular/core';
import { CollectDeposit } from 'src/app/modelos/collect-deposit';
import { DateServiceService } from 'src/app/services/dates/date-service.service';
import { DepositService } from 'src/app/services/deposit/deposit.service';

@Component({
  selector: 'app-deposito-cobros',
  templateUrl: './deposito-cobros.component.html',
  styleUrls: ['./deposito-cobros.component.scss'],
  standalone: false
})
export class DepositoCobrosComponent implements OnInit {

  public depositService = inject(DepositService);
  public dateServ = inject(DateServiceService);

  constructor() {


  }

  ngOnInit() {
    this.depositService.nuAmountDoc = 0;
    this.depositService.nuAmountDocConversion = 0;
  }


  selectCobro(cobroDetails: CollectDeposit, index: number) {
    this.depositService.markDepositDirty();
    if (cobroDetails.isSelected) {
      cobroDetails.inDepositCollect = true;
      this.depositService.onDepositValidToSend(true);
      this.depositService.deposit.depositCollect.push({
        idDepositCollect: 0,
        coDepositCollect: this.dateServ.generateCO(0),
        coDeposit: this.depositService.deposit.coDeposit,
        coDocument: cobroDetails.co_document,
        nuAmountTotal: cobroDetails.nu_amount_total,
        nuTotalDeposit: cobroDetails.total_deposit,
        coCollection: cobroDetails.co_collection,
        idCollection: cobroDetails.id_collection,
        st: 0,
        isSave: true,
        lbClient: cobroDetails.lb_client,
        daCollection: cobroDetails.da_collection,
      });

      this.depositService.deposit.nuValueLocal = cobroDetails.nu_value_local;

    } else {
      cobroDetails.inDepositCollect = false;
      const idx = this.depositService.deposit.depositCollect.findIndex(
        dc => dc.coCollection === cobroDetails.co_collection
      );
      if (idx !== -1) {
        this.depositService.deposit.depositCollect.splice(idx, 1);
      }
      if (this.depositService.deposit.depositCollect.length === 0) {
        this.depositService.onDepositValidToSend(false);
      }
    }

    this.depositService.totalizarDeposito();

  }
}
