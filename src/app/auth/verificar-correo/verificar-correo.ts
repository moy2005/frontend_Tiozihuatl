import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../api/services/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-verificar-correo',
  templateUrl: './verificar-correo.html'
})
export class VerificarCorreoComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParams['token'];

    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Enlace inválido',
        text: 'No se encontró un token en el enlace.'
      }).then(() => this.router.navigate(['/login']));
      return;
    }

    this.verificar(token);
  }

  verificar(token: string) {
    this.auth.verifyEmailLink(token).subscribe({
      next: (res: any) => {
        Swal.fire({
          icon: 'success',
          title: 'Correo verificado',
          text: 'Ahora puedes continuar con tu registro.'
        }).then(() =>
          this.router.navigate(['/registro'], { queryParams: { verified: true } })
        );
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'El enlace ya expiró o no es válido.'
        }).then(() => this.router.navigate(['/login']));
      }
    });
  }
}
