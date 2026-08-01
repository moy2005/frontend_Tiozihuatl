import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { UserProfileService } from '../../api/services/user-profile.service';
import { NewsService } from '../../api/services/news.service';
import { EventsService } from '../../api/services/events.service';
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
  isInicioRoute = false;
  isAuthRoute = false;
  homeIntroProgress = 0;

  /** Indica que los datos del usuario aún están cargando */
  loadingUser = false;

  // ── Mega menú noticias ──────────────────────────────────────────────
  noticiasMenu: any[] = [];
  eventosMenu: any[] = [];
  cargandoNoticiasMenu = false;
  cargandoEventosMenu = false;
  panelInstitucionalActivo: 'noticias' | 'eventos' | null = null;

  // ── Menú móvil ──────────────────────────────────────────────────────
  isMobileMenuOpen = false;

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
    private eventsService: EventsService,
    private ngZone: NgZone
  ) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.actualizarRutaInicio((event as NavigationEnd).urlAfterRedirects);
        this.verificarAutenticacion();
        this.panelInstitucionalActivo = null;
        this.isMobileMenuOpen = false;
        this.onScroll();
      });
  }

  ngOnInit() {
    this.actualizarRutaInicio(this.router.url);
    this.verificarAutenticacion();
    this.cargarNoticiasMenu();
    this.cargarEventosMenu();

    this.isScrolled = window.scrollY > this.SCROLL_THRESHOLD;
    this.homeIntroProgress = this.normalizarProgresoNavbar(this.calcularProgresoInicio());

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngOnDestroy() {
    clearTimeout(this.panelShowTimeout);
    clearTimeout(this.panelHideTimeout);
    window.removeEventListener('scroll', this.onScroll);
    cancelAnimationFrame(this.scrollRafId);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('home-navbar-route');
      document.body.classList.remove('auth-navbar-route');
    }
  }

  private onScroll = (): void => {
    cancelAnimationFrame(this.scrollRafId);
    this.scrollRafId = requestAnimationFrame(() => {
      const shouldBeScrolled = window.scrollY > this.SCROLL_THRESHOLD;
      const nextHomeProgress = this.isInicioRoute
        ? this.normalizarProgresoNavbar(this.calcularProgresoInicio())
        : 0;

      if (
        shouldBeScrolled !== this.isScrolled ||
        Math.abs(nextHomeProgress - this.homeIntroProgress) > 0.001
      ) {
        this.ngZone.run(() => {
          this.isScrolled = shouldBeScrolled;
          this.homeIntroProgress = nextHomeProgress;
        });
      }
    });
  };

  get homeBrandReveal(): number {
    if (!this.isInicioRoute) return 1;
    return Math.min(1, Math.max(0, (this.homeIntroProgress - 0.8) / 0.16));
  }

  private normalizarProgresoNavbar(progress: number): number {
    if (typeof window === 'undefined' || window.innerWidth >= 1024) return progress;

    // En móvil evitamos actualizar Angular en cada píxel de scroll. La marca
    // conserva un espacio estable y CSS realiza una única transición ligera.
    if (progress >= 0.9) return 1;
    return progress > 0.02 ? 0.1 : 0;
  }

  private actualizarRutaInicio(url: string): void {
    const cleanUrl = (url || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    this.isInicioRoute = cleanUrl === '/' || cleanUrl === '/inicio';
    this.isAuthRoute = [
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/verificar-correo',
      '/activar',
    ].includes(cleanUrl);
    if (!this.isInicioRoute) {
      this.homeIntroProgress = 0;
    }

    if (typeof document !== 'undefined') {
      document.body.classList.toggle('home-navbar-route', this.isInicioRoute);
      document.body.classList.toggle('auth-navbar-route', this.isAuthRoute);
    }
  }

  private calcularProgresoInicio(): number {
    if (typeof document === 'undefined' || typeof window === 'undefined') return 0;

    const sentinel = document.querySelector('[data-home-brand-sentinel]') as HTMLElement | null;
    if (!sentinel) return 0;

    const scrollY = window.scrollY;
    const sentinelTop = sentinel.getBoundingClientRect().top + scrollY;
    const sticky = sentinel.querySelector('.home-brand-sticky') as HTMLElement | null;
    const visibleHeight = sticky?.clientHeight || window.innerHeight;
    const scrollEnd = sentinelTop + sentinel.offsetHeight - visibleHeight;

    if (scrollEnd <= sentinelTop) return scrollY > sentinelTop ? 1 : 0;
    return Math.min(1, Math.max(0, (scrollY - sentinelTop) / (scrollEnd - sentinelTop)));
  }

  // ── Auth ────────────────────────────────────────────────────────────

  verificarAutenticacion() {
    const hasSession =
      !!localStorage.getItem('accessToken') ||
      !!localStorage.getItem('token') ||
      !!localStorage.getItem('refreshToken');

    if (hasSession) {
      this.isAuthenticated = true;
      // Solo pedir datos si aún no se han cargado (evita recargar en cada navegación)
      if (!this.userName) {
        this.obtenerDatosUsuario();
      }
    } else {
      this.isAuthenticated = false;
      this.userName = '';
      this.userRole = '';
      this.loadingUser = false;
    }
  }

  async obtenerDatosUsuario() {
    this.loadingUser = true;
    try {
      const res = await this.userService.getProfile().toPromise();

      // Construir "Nombre RM" a partir de nombre + a_paterno + a_materno
      const nombre    = (res.nombre    || '').trim();
      const paterno   = (res.a_paterno || '').trim();
      const materno   = (res.a_materno || '').trim();

      const inicialP  = paterno  ? paterno.charAt(0).toUpperCase()  : '';
      const inicialM  = materno  ? materno.charAt(0).toUpperCase()  : '';
      const apellidos = (inicialP + inicialM) || '';

      this.userName = apellidos ? `${nombre} ${apellidos}` : nombre || 'Usuario';
      this.userRole = res.rol || '';
    } catch (err: any) {
      if (err.status === 401 || err.status === 403) {
        this.cerrarSesionSilencioso();
      }
    } finally {
      this.loadingUser = false;
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
    this.loadingUser = false;
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

  mostrarPanelInstitucional(tipo: 'noticias' | 'eventos') {
    clearTimeout(this.panelHideTimeout);
    this.panelShowTimeout = setTimeout(() => {
      this.panelInstitucionalActivo = tipo;
    }, 60);
  }

  ocultarPanelInstitucional() {
    clearTimeout(this.panelShowTimeout);
    this.panelHideTimeout = setTimeout(() => {
      this.panelInstitucionalActivo = null;
    }, 120);
  }

  // ── Menú móvil ──────────────────────────────────────────────────────
  cargarEventosMenu() {
    this.cargandoEventosMenu = true;
    this.eventsService.getPublicEvents({ limit: 3 }).subscribe({
      next: (eventos) => {
        this.eventosMenu = eventos || [];
        this.cargandoEventosMenu = false;
      },
      error: () => {
        this.eventosMenu = [];
        this.cargandoEventosMenu = false;
      }
    });
  }

  get panelInstitucionalVisible(): boolean {
    return this.panelInstitucionalActivo !== null;
  }

  get panelInstitucionalTitulo(): string {
    return this.panelInstitucionalActivo === 'eventos'
      ? 'Ultimos eventos'
      : 'Ultimas noticias';
  }

  get panelInstitucionalLink(): string {
    return this.panelInstitucionalActivo === 'eventos' ? '/eventos' : '/noticias';
  }

  get panelInstitucionalItems(): any[] {
    return this.panelInstitucionalActivo === 'eventos'
      ? this.eventosMenu
      : this.noticiasMenu;
  }

  get panelInstitucionalCargando(): boolean {
    return this.panelInstitucionalActivo === 'eventos'
      ? this.cargandoEventosMenu
      : this.cargandoNoticiasMenu;
  }

  obtenerPreviewLink(item: any) {
    return this.panelInstitucionalActivo === 'eventos'
      ? ['/eventos', item.id_evento]
      : ['/noticias', item.id_noticia];
  }

  obtenerPreviewMedia(item: any): string {
    return item?.imagen_principal || item?.imagen_url || item?.imagenes?.[0]?.url || '';
  }

  toggleMobileMenu(event: Event) {
    this.isMobileMenuOpen = (event.target as HTMLInputElement).checked;
  }
}
