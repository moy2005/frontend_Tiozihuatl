import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { ConnectivityService } from './connectivity.service';
import { allowsOffline } from './pwa-policy';

export const onlineGuard: CanActivateChildFn = (_route, state) => {
  const connection = inject(ConnectivityService);
  return allowsOffline(state.url) || connection.available() || inject(Router).createUrlTree(['/sin-conexion'], { queryParams: { volver: state.url } });
};
