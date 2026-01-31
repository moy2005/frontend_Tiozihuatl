import { Component, signal } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Navbar } from './components/navbar/navbar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar],
  templateUrl: './app.html',
})
export class App {

  mostrarNavbar = signal(true);

  constructor(
    private router: Router,
    private route: ActivatedRoute
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
      });
  }
}
