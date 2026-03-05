import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-500',
  templateUrl: './error-500.component.html',
  styleUrls: ['./error-500.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule], // ✅ Agregado RouterModule
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Error500Component {
  constructor(private router: Router) {}

  reloadPage() {
    window.location.reload();
  }

  goHome() {
    this.router.navigate(['/inicio']);
  }
}