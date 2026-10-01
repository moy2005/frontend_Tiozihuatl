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
import { allowsOffline } from './pwa/pwa-policy';

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
  mostrarNavbar = signal(true);
  mostrarFooter = signal(true);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService
  ) {
    afterNextRender(() => { this.connection.start(); this.pwa.start(); });
    effect(() => {
      if (!this.connection.available() && !allowsOffline(this.router.url)) {
        void this.router.navigate(['/sin-conexion'], { queryParams: { volver: this.router.url }, replaceUrl: true });
      }
    });
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (!this.connection.available() && !allowsOffline(this.router.url)) {
          void this.router.navigate(['/sin-conexion'], { queryParams: { volver: this.router.url }, replaceUrl: true });
          return;
        }
        this.auth.registerSessionActivity();

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
