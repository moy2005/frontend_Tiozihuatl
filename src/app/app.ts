import { Component, afterNextRender, effect, inject, signal } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { AuthService } from './api/services/auth';
import { VirtualAssistantComponent } from './components/virtual-assistant/virtual-assistant';
import { PwaStatusComponent } from './pwa/pwa-status.component';
import { ConnectivityService } from './pwa/connectivity.service';
import { PwaService } from './pwa/pwa.service';
import { PushNotificationService } from './pwa/push-notification.service';
import { allowsOffline } from './pwa/pwa-policy';
import { playSplashIntro } from './splash-intro';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar, Footer, VirtualAssistantComponent, PwaStatusComponent],
  templateUrl: './app.html',
  styles: [`
    .app-shell {
      position: relative;
      min-height: calc(100vh - 10rem);
    }

    @media (max-width: 768px) {
      .app-shell {
        min-height: calc(100vh - 8rem);
      }
    }
  `],
})
export class App {
  readonly connection = inject(ConnectivityService);
  private readonly pwa = inject(PwaService);
  private readonly push = inject(PushNotificationService);
  mostrarNavbar = signal(true);
  mostrarFooter = signal(true);
  private readonly activeUrl = signal('/');

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService
  ) {
    this.activeUrl.set(this.router.url);
    afterNextRender(() => {
      this.connection.start();
      this.pwa.start();
      this.push.start();
      void this.push.syncSession(() => this.auth.getSessionUserId());
      void playSplashIntro(this.router);
    });
    effect(() => {
      // Espera a que se confirme el destino: no redirigir por la ruta anterior
      // si la conexión se pierde mientras se abre una página disponible offline.
      if (this.router.currentNavigation()) return;
      const url = this.activeUrl();
      if (!this.connection.available() && !allowsOffline(url)) {
        void this.router.navigate(['/sin-conexion'], { queryParams: { volver: url }, replaceUrl: true });
      }
    });
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => {
        this.activeUrl.set(event.urlAfterRedirects);
        this.auth.registerSessionActivity();
        void this.push.syncSession(() => this.auth.getSessionUserId());

        let currentRoute = this.route.firstChild;
        let hideNavbar = false;

        while (currentRoute) {
          if (currentRoute.snapshot.data['hideNavbar']) {
            hideNavbar = true;
            break;
          }
          currentRoute = currentRoute.firstChild;
        }

        this.mostrarNavbar.set(!hideNavbar);
        this.mostrarFooter.set(!hideNavbar);
      });
  }
}
