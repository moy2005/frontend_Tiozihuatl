import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,  
  imports: [CommonModule, FormsModule],  
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  protected readonly title = signal('frontend');

  constructor(private router: Router) {}

  onSubmit(form: NgForm) {
    if (form.valid) {
      const password = form.value.password;
      const confirmPassword = form.value.confirmPassword;

      if (password !== confirmPassword) {
        alert('Las contraseñas no coinciden');
        return;
      }

      // Aquí iría la lógica para enviar los datos al backend
      console.log('Registro exitoso', form.value);

      alert('Cuenta creada correctamente!');
      form.resetForm();

      // Redirigir al login
      this.router.navigate(['/login']);
    } else {
      alert('Por favor completa todos los campos correctamente');
    }
  }
}