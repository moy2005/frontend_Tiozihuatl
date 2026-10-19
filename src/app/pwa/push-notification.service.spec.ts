import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { PushNotificationService } from './push-notification.service';
import { SystemNotificationService } from './system-notification.service';
import { ConnectivityService } from './connectivity.service';

describe('Permiso local y suscripción del servidor', () => {
  let service: PushNotificationService;
  let http: HttpTestingController;
  let permission: jasmine.Spy;
  let requestPermission: jasmine.Spy;
  let subscription: BehaviorSubject<PushSubscription | null>;
  let push: { isEnabled: boolean; subscription: BehaviorSubject<PushSubscription | null>; requestSubscription: jasmine.Spy; unsubscribe: jasmine.Spy };
  const sub = { endpoint: 'https://push.example/sub', toJSON: () => ({ endpoint: 'https://push.example/sub' }) } as PushSubscription;
  const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

  beforeEach(() => {
    localStorage.removeItem('iest-system-notifications');
    permission = spyOnProperty(Notification, 'permission', 'get').and.returnValue('default');
    requestPermission = spyOn(Notification, 'requestPermission').and.resolveTo('granted');
    subscription = new BehaviorSubject<PushSubscription | null>(null);
    push = {
      isEnabled: true, subscription,
      requestSubscription: jasmine.createSpy().and.callFake(async () => { subscription.next(sub); return sub; }),
      unsubscribe: jasmine.createSpy().and.callFake(async () => subscription.next(null)),
    };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: SwPush, useValue: push },
      { provide: ToastrService, useValue: { warning: jasmine.createSpy() } },
      { provide: SystemNotificationService, useValue: { connectionChanged: jasmine.createSpy().and.resolveTo() } },
      { provide: ConnectivityService, useValue: { state: signal('online'), available: signal(true), confirmed: signal(true) } },
    ] });
    service = TestBed.inject(PushNotificationService);
    http = TestBed.inject(HttpTestingController);
    service.start();
    void service.syncSession(() => 1);
  });
  afterEach(() => { http.verify(); localStorage.removeItem('iest-system-notifications'); });

  it('pide permiso desde el clic antes de la red y conserva avisos locales sin VAPID', async () => {
    const enabled = service.enable();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    http.expectNone(r => r.url.endsWith('/public-key'));
    await settle();
    http.expectOne(r => r.url.endsWith('/public-key')).flush({ data: { enabled: false, publicKey: null } });
    await enabled;
    expect(service.permission()).toBe('granted');
    expect(service.active()).toBeTrue();
    expect(service.state()).toBe('unconfigured');
    expect(push.requestSubscription).not.toHaveBeenCalled();
  });

  it('no requiere red para activar avisos locales estando offline', async () => {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
    await service.enable();
    expect(service.active()).toBeTrue();
    expect(service.state()).toBe('pending');
    http.expectNone(() => true);
  });

  it('solo anuncia suscripción completa después de guardarla y la reutiliza sin otro permiso', async () => {
    permission.and.returnValue('granted');
    const enabled = service.enable();
    await settle();
    http.expectOne(r => r.url.endsWith('/public-key')).flush({ data: { enabled: true, publicKey: 'public-key' } });
    await settle();
    expect(service.state()).not.toBe('on');
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/subscribe')).flush({ success: true });
    await enabled;
    expect(service.state()).toBe('on');
    await service.syncSession();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(push.requestSubscription).toHaveBeenCalledTimes(1);
    http.expectNone(() => true);
  });

  it('conserva estado pendiente si falla el registro y permite reintentar', async () => {
    const enabled = service.enable();
    await settle();
    http.expectOne(r => r.url.endsWith('/public-key')).flush({ data: { enabled: true, publicKey: 'public-key' } });
    await settle();
    http.expectOne(r => r.method === 'POST').flush({}, { status: 503, statusText: 'Unavailable' });
    await enabled;
    expect(service.state()).toBe('pending');
    const retry = service.syncSession();
    await settle();
    http.expectOne(r => r.url.endsWith('/public-key')).flush({ data: { enabled: true, publicKey: 'public-key' } });
    await settle();
    http.expectOne(r => r.method === 'POST').flush({});
    await retry;
    expect(service.state()).toBe('on');
  });

  it('no solicita suscripción si el usuario rechaza o cierra el permiso', async () => {
    requestPermission.and.resolveTo('denied');
    await service.enable();
    expect(service.state()).toBe('denied');
    expect(service.active()).toBeFalse();
    expect(push.requestSubscription).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });

  it('da de baja en el navegador aunque no haya red y respeta la elección tras recargar', async () => {
    permission.and.returnValue('granted');
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
    await service.enable();
    subscription.next(sub);
    await service.disable();
    expect(push.unsubscribe).toHaveBeenCalledTimes(1);
    expect(service.state()).toBe('off');
    expect(localStorage.getItem('iest-system-notifications')).toBe('off');
    const reloaded = TestBed.runInInjectionContext(() => new PushNotificationService());
    reloaded.start();
    expect(reloaded.active()).toBeFalse();
    http.expectNone(() => true);
  });

  it('al cerrar sesión no vuelve a suscribir a la siguiente cuenta sin su elección', async () => {
    permission.and.returnValue('granted');
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
    await service.enable();
    subscription.next(sub);
    await service.signOut();
    expect(push.unsubscribe).toHaveBeenCalledTimes(1);
    expect(service.active()).toBeFalse();
    await service.syncSession(() => 2);
    expect(push.requestSubscription).not.toHaveBeenCalled();
    http.expectNone(() => true);
  });
});
