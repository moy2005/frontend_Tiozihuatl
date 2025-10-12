import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  // Propiedades para el formulario
  email: string = '';
  password: string = '';

  // Método que se ejecuta al enviar el formulario
  onSubmit() {
    if (this.email && this.password && this.password.length >= 6) {
      console.log('Formulario válido');
      console.log('Email:', this.email);
      console.log('Password:', this.password);
      
      // Aquí irá tu lógica de autenticación
      // Por ejemplo: llamar a un servicio de autenticación
      // this.authService.login(this.email, this.password).subscribe(...)
    } else {
      console.log('Formulario inválido');
    }
  }
}