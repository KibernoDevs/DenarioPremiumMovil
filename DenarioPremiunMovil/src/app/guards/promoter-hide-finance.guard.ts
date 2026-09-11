import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GlobalConfigService } from '../services/globalConfig/global-config.service';

export function isPromoterUser(): boolean {
  const userStr = localStorage.getItem('user');
  if (!userStr) {
    return false;
  }
  try {
    const user = JSON.parse(userStr) as { promotor?: boolean | string };
    return user.promotor === true || String(user.promotor ?? '').toLowerCase() === 'true';
  } catch {
    return false;
  }
}

export function isPromoterHideFinanceActive(config: GlobalConfigService): boolean {
  return isPromoterUser()
    && (config.get('promoterHideFinance') || '').toLowerCase() === 'true';
}

export const promoterRestrictedRouteGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (isPromoterUser()) {
    void router.navigate(['/home']);
    return false;
  }
  return true;
};

export const promoterHideFinanceGuard: CanActivateFn = () => {
  const config = inject(GlobalConfigService);
  const router = inject(Router);
  if (isPromoterHideFinanceActive(config)) {
    void router.navigate(['/home']);
    return false;
  }
  return true;
};
