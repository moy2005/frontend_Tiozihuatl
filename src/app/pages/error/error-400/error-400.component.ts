import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router, RouterModule } from '@angular/router';  // Agregado Router y RouterModule
import { CommonModule } from '@angular/common';  //  Agregado CommonModule

@Component({
  selector: 'app-error-400',
  templateUrl: './error-400.component.html',
  styleUrls: ['./error-400.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule],  
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class Error400Component {
  constructor(private router: Router) {}  

  goBack() {
    window.history.back();  
  }

  goHome() {  
    this.router.navigate(['/inicio']);
  }
}