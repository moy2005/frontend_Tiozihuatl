import { Injectable } from '@angular/core';
import { ConnectionState } from './connectivity.service';
import { claimConnectionNotice } from './connection-notification.store';

const CONNECTION_TAG = 'iest-connection';

@Injectable({ providedIn: 'root' })
export class SystemNotificationService {
  private queue: Promise<void> = Promise.resolve();

  connectionChanged(state: ConnectionState, stillCurrent: () => boolean): Promise<void> {
    this.queue = this.queue.then(async () => {
      if (state === 'unavailable' || !stillCurrent() || Notification.permission !== 'granted') return;
      // getRegistration does not wait indefinitely when no worker exists.
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active || !stillCurrent()) return;
      const claimed = await claimConnectionNotice(state);
      if (!stillCurrent()) return;
      if (state === 'online') {
        const notices = await registration.getNotifications({ tag: CONNECTION_TAG });
        if (stillCurrent()) notices.forEach(notice => notice.close());
        return;
      }
      if (!claimed) return;
      await registration.showNotification('Sin conexión', {
        body: 'Puedes seguir consultando la información descargada del Instituto.',
        tag: CONNECTION_TAG, lang: 'es-MX',
        icon: '/icons/iest-icon-192.png', badge: '/icons/favicon-32.png',
        data: { onActionClick: { default: {
          operation: 'navigateLastFocusedOrOpen',
          url: '/sin-conexion',
        } } },
      });
    }).catch(() => {
      // Keep the in-app status if storage, permission or the OS fails.
    });
    return this.queue;
  }
}
