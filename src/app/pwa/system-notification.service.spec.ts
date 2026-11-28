import { SystemNotificationService } from './system-notification.service';

const resetStore = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase('tiozihuatl-connection-notices');
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

describe('Avisos del sistema por conexión', () => {
  let permission: jasmine.Spy;
  let show: jasmine.Spy;
  let registration: jasmine.Spy;
  let close: jasmine.Spy;

  beforeEach(async () => {
    await resetStore();
    permission = spyOnProperty(Notification, 'permission', 'get').and.returnValue('granted');
    show = jasmine.createSpy('showNotification').and.resolveTo();
    close = jasmine.createSpy('close');
    registration = spyOn(navigator.serviceWorker, 'getRegistration').and.resolveTo({
      active: {}, showNotification: show, getNotifications: async () => [{ close }],
    } as unknown as ServiceWorkerRegistration);
  });
  afterEach(resetStore);

  it('coordina pestañas simultáneas y conserva la deduplicación tras una recarga', async () => {
    await Promise.all([
      new SystemNotificationService().connectionChanged('offline', () => true),
      new SystemNotificationService().connectionChanged('offline', () => true),
    ]);
    await new SystemNotificationService().connectionChanged('offline', () => true);
    expect(show).toHaveBeenCalledTimes(1);
    expect(show.calls.mostRecent().args[0]).toBe('Sin conexión');
    await new SystemNotificationService().connectionChanged('online', () => true);
    expect(show).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    await new SystemNotificationService().connectionChanged('offline', () => true);
    expect(show).toHaveBeenCalledTimes(2);
  });

  it('no genera avisos del sistema por una demora del servicio', async () => {
    const service = new SystemNotificationService();
    await service.connectionChanged('online', () => true);
    expect(show).not.toHaveBeenCalled();
    await service.connectionChanged('unavailable', () => true);
    expect(show).not.toHaveBeenCalled();
  });

  it('respeta permisos, baja voluntaria y transiciones que ya no están vigentes', async () => {
    permission.and.returnValue('denied');
    await new SystemNotificationService().connectionChanged('offline', () => true);
    permission.and.returnValue('granted');
    await new SystemNotificationService().connectionChanged('offline', () => false);
    expect(registration).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it('tolera falta de worker y rechazo del sistema sin propagar un error', async () => {
    registration.and.resolveTo(undefined);
    const service = new SystemNotificationService();
    await service.connectionChanged('offline', () => true);
    expect(show).not.toHaveBeenCalled();
    registration.and.resolveTo({ active: {}, showNotification: show });
    show.and.rejectWith(new Error('Permiso revocado'));
    await expectAsync(service.connectionChanged('offline', () => true)).toBeResolved();
  });
});
