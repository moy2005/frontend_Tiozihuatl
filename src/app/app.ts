import { Component, signal } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { AuthService } from './api/services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar, Footer],
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
  mostrarNavbar = signal(true);
  mostrarFooter = signal(true);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService
  ) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
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
