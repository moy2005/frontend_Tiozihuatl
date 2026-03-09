import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { UserProfileService } from '../../api/services/user-profile.service';
import { NewsService } from '../../api/services/news.service';
import Swal from 'sweetalert2';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class Navbar implements OnInit, OnDestroy {
  isAuthenticated = false;
  userName = '';
  userRole = '';

  // ── Mega menú noticias ──────────────────────────────────────────────
  noticiasMenu: any[] = [];
  cargandoNoticiasMenu = false;
  noticiasPanelVisible = false;

  private panelShowTimeout: any;
  private panelHideTimeout: any;

  // ── Scroll ──────────────────────────────────────────────────────────
  isScrolled = false;
  private scrollRafId = 0;
  private readonly SCROLL_THRESHOLD = 80;

  constructor(
    private router: Router,
    private userService: UserProfileService,
    private newsService: NewsService,
    private ngZone: NgZone
  ) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.verificarAutenticacion();
        this.noticiasPanelVisible = false;
      });
  }

  ngOnInit() {
    this.verificarAutenticacion();
    this.cargarNoticiasMenu();

    this.isScrolled = window.scrollY > this.SCROLL_THRESHOLD;

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngOnDestroy() {
    clearTimeout(this.panelShowTimeout);
    clearTimeout(this.panelHideTimeout);
    window.removeEventListener('scroll', this.onScroll);
    cancelAnimationFrame(this.scrollRafId);
  }

  private onScroll = (): void => {
    cancelAnimationFrame(this.scrollRafId);
    this.scrollRafId = requestAnimationFrame(() => {
      const shouldBeScrolled = window.scrollY > this.SCROLL_THRESHOLD;
      if (shouldBeScrolled !== this.isScrolled) {
        this.ngZone.run(() => { this.isScrolled = shouldBeScrolled; });
      }
    });
  };

  // ── Auth ────────────────────────────────────────────────────────────

  verificarAutenticacion() {
    const token = localStorage.getItem('accessToken');
    if (token) {
      this.isAuthenticated = true;
      this.obtenerDatosUsuario();
    } else {
      this.isAuthenticated = false;
      this.userName = '';
      this.userRole = '';
    }
  }

  async obtenerDatosUsuario() {
    try {
      const res = await this.userService.getProfile().toPromise();
      this.userName = res.nombre || 'Usuario';
      this.userRole = res.rol || '';
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        this.cerrarSesionSilencioso();
      }
    }
  }

  cerrarSesion() {
    Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Tu sesión actual se cerrará.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.cerrarSesionSilencioso();
      }
    });
  }

  private cerrarSesionSilencioso() {
    localStorage.clear();
    this.isAuthenticated = false;
    this.userName = '';
    this.userRole = '';
    this.router.navigate(['/login']);
  }

  irPerfil() { this.router.navigate(['/perfil']); }
  irPanelAdmin() { this.router.navigate(['/admin']); }
  esAdmin(): boolean { return this.userRole === 'Administrador'; }

  getIniciales(): string {
    if (!this.userName) return 'U';
    const palabras = this.userName.trim().split(' ');
    if (palabras.length >= 2) return (palabras[0][0] + palabras[1][0]).toUpperCase();
    return palabras[0][0].toUpperCase();
  }

  // ── Noticias del mega menú ──────────────────────────────────────────

  cargarNoticiasMenu() {
    this.cargandoNoticiasMenu = true;
    this.newsService.getPublicNews().subscribe({
      next: (noticias) => {
        this.noticiasMenu = (noticias || []).slice(0, 3);
        this.cargandoNoticiasMenu = false;
      },
      error: () => {
        this.noticiasMenu = [];
        this.cargandoNoticiasMenu = false;
      }
    });
  }

  mostrarPanelNoticias() {
    clearTimeout(this.panelHideTimeout);
    this.panelShowTimeout = setTimeout(() => {
      this.noticiasPanelVisible = true;
    }, 60);
  }

  ocultarPanelNoticias() {
    clearTimeout(this.panelShowTimeout);
    this.panelHideTimeout = setTimeout(() => {
      this.noticiasPanelVisible = false;
    }, 120);
  }
}