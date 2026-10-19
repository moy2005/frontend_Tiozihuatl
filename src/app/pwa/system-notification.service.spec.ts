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

  beforeEach(async () => {
    await resetStore();
    permission = spyOnProperty(Notification, 'permission', 'get').and.returnValue('granted');
    show = jasmine.createSpy('showNotification').and.resolveTo();
    registration = spyOn(navigator.serviceWorker, 'getRegistration').and.resolveTo({
      active: {}, showNotification: show,
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
    expect(show).toHaveBeenCalledTimes(2);
    expect(show.calls.mostRecent().args[0]).toBe('Conexión restablecida');
    await new SystemNotificationService().connectionChanged('offline', () => true);
    expect(show).toHaveBeenCalledTimes(3);
  });

  it('no anuncia recuperación al abrir online por primera vez y distingue caída de la API', async () => {
    const service = new SystemNotificationService();
    await service.connectionChanged('online', () => true);
    expect(show).not.toHaveBeenCalled();
    await service.connectionChanged('unavailable', () => true);
    expect(show.calls.mostRecent().args[0]).toBe('Servicio no disponible');
    expect(show.calls.mostRecent().args[1].data.onActionClick.default.url).toBe('/sin-conexion');
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
