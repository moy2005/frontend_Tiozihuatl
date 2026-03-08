import { Component, signal } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Navbar } from './components/navbar/navbar';
import {Footer} from './components/footer/footer'

import { BreadcrumbsComponent } from './components/breadcrumbs/breadcrumbs.component';
import { AuthService } from './api/services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar, BreadcrumbsComponent],
  templateUrl: './app.html',
})
export class App {

  mostrarNavbar = signal(true);
   mostrarBreadcrumbs = signal(false);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService 
  ) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {

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

// 🔹 Breadcrumbs (lógica real)
        const url = this.router.url;
        const loggedIn = this.auth.isLoggedIn();

        if (!loggedIn || url === '/inicio') {
          this.mostrarBreadcrumbs.set(false);
        } else {
          this.mostrarBreadcrumbs.set(true);
        }
      });
  }
}
