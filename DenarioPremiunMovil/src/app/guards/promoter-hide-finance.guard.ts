import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';

export function isPromoterHideFinanceActive(config: GlobalConfigService): boolean {
  let promotor = false;
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr) as { promotor?: boolean };
      promotor = !!user.promotor;
    } catch {
      promotor = false;
    }
  }
  return promotor && (config.get('promoterHideFinance') || '').toLowerCase() === 'true';
}

export const promoterHideFinanceGuard: CanActivateFn = () => {
  const config = inject(GlobalConfigService);
  const router = inject(Router);
  if (isPromoterHideFinanceActive(config)) {
    void router.navigate(['/home']);
    return false;
  }
  return true;
};
