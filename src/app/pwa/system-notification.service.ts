import { Injectable } from '@angular/core';
import { ConnectionState } from './connectivity.service';
import { claimConnectionNotice } from './connection-notification.store';

const MESSAGES: Record<ConnectionState, { title: string; body: string }> = {
  offline: { title: 'Sin conexión', body: 'Puedes seguir consultando la información descargada del Instituto.' },
  unavailable: { title: 'Servicio no disponible', body: 'No pudimos contactar al Instituto. La información descargada sigue disponible.' },
  online: { title: 'Conexión restablecida', body: 'Los servicios del Instituto vuelven a estar disponibles.' },
};

@Injectable({ providedIn: 'root' })
export class SystemNotificationService {
  private queue: Promise<void> = Promise.resolve();

  connectionChanged(state: ConnectionState, stillCurrent: () => boolean): Promise<void> {
    this.queue = this.queue.then(async () => {
      if (!stillCurrent() || Notification.permission !== 'granted') return;
      // getRegistration does not wait indefinitely when no worker exists.
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active || !stillCurrent()) return;
      if (!await claimConnectionNotice(state) || !stillCurrent()) return;
      const { title, body } = MESSAGES[state];
      await registration.showNotification(title, {
        body, tag: 'iest-connection', lang: 'es-MX',
        icon: '/icons/iest-icon-192.png', badge: '/icons/favicon-32.png',
        data: { onActionClick: { default: {
          operation: 'navigateLastFocusedOrOpen',
          url: state === 'online' ? '/inicio' : '/sin-conexion',
        } } },
      });
    }).catch(() => {
      // Keep the in-app status if storage, permission or the OS fails.
    });
    return this.queue;
  }
}
