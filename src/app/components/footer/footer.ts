import {
  Component, OnInit, OnDestroy, AfterViewInit,
  CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation,
  ElementRef, ViewChild, ChangeDetectorRef, NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContactService } from '../../api/services/contact.service';
import { firstValueFrom } from 'rxjs';

interface RouteLink    { label: string; path: string; }
interface PublicRoutes { institucional: RouteLink[]; servicios: RouteLink[]; legal: RouteLink[]; academico: RouteLink[]; }
interface ContactInfo  { telefono: string; correo: string; direccion: string; horario: string; facebook: string; instagram: string; twitter: string; whatsapp: string; estado?: string; }

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None,
})
export class Footer implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('footerEl')     footerEl!:     ElementRef<HTMLElement>;
  @ViewChild('heroSentinel') heroSentinel!: ElementRef<HTMLElement>;
  @ViewChild('logoEl')       logoEl!:       ElementRef<HTMLElement>;
  @ViewChild('nameEl')       nameEl!:       ElementRef<HTMLElement>;
  @ViewChild('contentEl')    contentEl!:    ElementRef<HTMLElement>;
  @ViewChild('badgeEl')      badgeEl!:      ElementRef<HTMLElement>;
  @ViewChild('nameSubEl')    nameSubEl!:    ElementRef<HTMLElement>;

  currentYear      = new Date().getFullYear();
  cargandoContacto = false;
  contacto: ContactInfo = { telefono:'', correo:'', direccion:'', horario:'', facebook:'', instagram:'', twitter:'', whatsapp:'' };

  publicRoutes: PublicRoutes = {
    institucional: [
      { label:'Inicio',        path:'/inicio'      },
      { label:'Quiénes somos', path:'/about'       },
      { label:'Noticias',      path:'/noticias'    },
      { label:'Contáctanos',   path:'/contactanos' },
      { label:'Calendario',    path:'/calendario'  },
    ],
    servicios: [
      { label:'Catálogo bibliográfico', path:'/catalogo'  },
      { label:'Revistas digitales',     path:'/magazines' },
    ],
    legal: [
      { label:'Aviso de privacidad', path:'/privacidad' },
      { label:'Términos de uso',     path:'/terminos'   },
      { label:'Seguridad',           path:'/seguridad'  },
    ],
    academico: [
      { label:'Iniciar sesión', path:'/login'        },
      { label:'Registrarse',    path:'/register'     },
      { label:'Mi perfil',      path:'/perfil'       },
      { label:'Mis compras',    path:'/my-purchases' },
      { label:'Carrito',        path:'/cart'         },
    ],
  };

  private scrollListener!: () => void;
  private resizeListener!: () => void;
  private resizeTimeout: any;
  private waveObserver!:   IntersectionObserver;

  private destLogo!:    { x: number; y: number; scale: number };
  private destName!:    { x: number; y: number; scale: number };
  private destNameSub!: { x: number; y: number; scale: number };

  constructor(
    private contactService: ContactService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void { this.cargarContacto(); }

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.calcDestinations();
        this.initScrollTransform();
        this.initResizeListener();
        this.initWaveObserver();
      }, 120);
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollListener);
    window.removeEventListener('resize', this.resizeListener);
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.waveObserver?.disconnect();
  }

  private initResizeListener(): void {
    this.resizeListener = () => {
      if (this.resizeTimeout) { clearTimeout(this.resizeTimeout); }
      this.resizeTimeout = setTimeout(() => {
        this.calcDestinations();
        if (this.scrollListener) {
          this.scrollListener(); // Force scroll view recalculation
        }
      }, 150);
    };
    window.addEventListener('resize', this.resizeListener, { passive: true });
  }

  private calcDestinations(): void {
    if (window.innerWidth <= 640) return;

    const logo    = this.logoEl?.nativeElement;
    const name    = this.nameEl?.nativeElement;
    const badge   = this.badgeEl?.nativeElement;
    const nameSub = this.nameSubEl?.nativeElement;

    if (!logo || !name || !badge) return;

    const badgeImg  = badge.querySelector('img');
    const badgeSpan = badge.querySelector('span');

    const logoRect = logo.getBoundingClientRect();
    const nameRect = name.getBoundingClientRect();

    const badgeRect     = badge.getBoundingClientRect();
    const badgeImgRect  = badgeImg  ? badgeImg.getBoundingClientRect()  : badgeRect;
    const badgeNameRect = badgeSpan ? badgeSpan.getBoundingClientRect() : badgeRect;

    const logoScaleFinal = badgeImgRect.width  / logoRect.width;
    const nameScaleFinal = badgeNameRect.height / nameRect.height;

    this.destLogo = {
      x:     badgeImgRect.left + badgeImgRect.width  / 2 - (logoRect.left + logoRect.width  / 2),
      y:     badgeImgRect.top  + badgeImgRect.height / 2 - (logoRect.top  + logoRect.height / 2),
      scale: logoScaleFinal,
    };

    this.destName = {
      x:     badgeNameRect.left + badgeNameRect.width / 2 - (nameRect.left + nameRect.width / 2),
      y:     badgeNameRect.top  + badgeNameRect.height / 2 - (nameRect.top + nameRect.height / 2),
      scale: Math.min(nameScaleFinal, 0.32),
    };

    if (nameSub) {
      const nameSubRect = nameSub.getBoundingClientRect();
      this.destNameSub = {
        x:     badgeNameRect.left + badgeNameRect.width / 2 - (nameSubRect.left + nameSubRect.width / 2),
        y:     badgeNameRect.top  + badgeNameRect.height / 2 - (nameSubRect.top + nameSubRect.height / 2),
        scale: Math.min(nameScaleFinal * 0.8, 0.28),
      };
    }
  }

  /**
   * SINCRONÍA LOGO + NOMBRE → BADGE:
   *
   * El logo viaja hasta el badge-img y se oculta al llegar (p≥0.95).
   * El nombre y subtítulo viajan hasta el badge-span y se ocultan al llegar (p≥0.95).
   * El badge (img + span) empieza a aparecer desde p=0.80, de modo que
   * cuando logo/nombre llegan y desaparecen (p≈0.95), el badge ya tiene
   * opacity cercana a 1 — la fusión es visualmente continua.
   *
   * El subtítulo "Tiozihuatl" viaja al mismo destino que el nombre
   * y también se oculta en p≥0.95, dado que el badge ya incluye
   * "Instituto de Estudios Superiores Tiozihuatl" completo.
   */
  private initScrollTransform(): void {
    const logo     = this.logoEl?.nativeElement;
    const name     = this.nameEl?.nativeElement;
    const nameSub  = this.nameSubEl?.nativeElement;
    const badge    = this.badgeEl?.nativeElement;
    const sentinel = this.heroSentinel?.nativeElement;
    const overlay  = sentinel?.querySelector('.iest-hero-overlay') as HTMLElement | null;

    if (!logo || !name || !sentinel || !badge || !overlay) return;

    this.scrollListener = () => {
      const viewW   = window.innerWidth;
      
      if (viewW <= 640) {
        // En móvil no hay animación, se delega al CSS.
        // Limpiamos estilos en línea por si se venía de una pantalla grande.
        logo.style.visibility = ''; logo.style.transform = '';
        name.style.visibility = ''; name.style.transform = '';
        if (nameSub) { nameSub.style.visibility = ''; nameSub.style.transform = ''; }
        badge.style.opacity = '';
        overlay.style.background = '';
        return;
      }

      const viewH   = window.innerHeight;
      const scrollY = window.scrollY;

      const sentinelTop = sentinel.getBoundingClientRect().top + scrollY;
      const sentinelH   = sentinel.offsetHeight;
      const scrollStart = sentinelTop;
      const scrollEnd   = sentinelTop + sentinelH - viewH;

      if (scrollEnd <= scrollStart) {
        this.applyFull(logo, name, nameSub, badge, overlay);
        return;
      }

      const raw = (scrollY - scrollStart) / (scrollEnd - scrollStart);
      const p   = Math.min(1, Math.max(0, raw));
      const ep  = this.easeInOut(p);

      // Restaurar visibilidad al hacer scroll hacia atrás
      logo.style.visibility  = 'visible';
      name.style.visibility  = 'visible';
      if (nameSub) nameSub.style.visibility = 'visible';

      // ── LOGO: viaja al centro del badge-img ──
      if (this.destLogo) {
        const tx = ep * this.destLogo.x;
        const ty = ep * this.destLogo.y;
        const sc = 1 + ep * (this.destLogo.scale - 1);
        logo.style.transform  = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`;
        // Se oculta exactamente cuando llega: p≥0.95
        logo.style.visibility = p >= 0.95 ? 'hidden' : 'visible';
      }

      // ── NOMBRE: viaja al badge-span, desaparece al llegar ──
      if (this.destName) {
        const tx = ep * this.destName.x;
        const ty = ep * this.destName.y;
        const sc = 1 + ep * (this.destName.scale - 1);
        name.style.transform       = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`;
        name.style.transformOrigin = 'center center';
        // Mismo umbral que el logo: p≥0.95
        name.style.visibility      = p >= 0.95 ? 'hidden' : 'visible';
      }

      // ── SUBTÍTULO: mismo comportamiento que el nombre ──
      if (this.destNameSub && nameSub) {
        const tx = ep * this.destNameSub.x;
        const ty = ep * this.destNameSub.y;
        const sc = 1 + ep * (this.destNameSub.scale - 1);
        nameSub.style.transform       = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${sc.toFixed(4)})`;
        nameSub.style.transformOrigin = 'center center';
        nameSub.style.visibility      = p >= 0.95 ? 'hidden' : 'visible';
      }

      // ── OVERLAY: fondo azul desaparece en p=0.50→0.90 ──
      const bgAlpha = 1 - Math.min(1, Math.max(0, (p - 0.50) / 0.40));
      overlay.style.background = `rgba(63,166,232,${bgAlpha.toFixed(4)})`;

      // ── BADGE: aparece en p=0.80→1.0 ──
      // Empieza justo antes de que logo/nombre lleguen (p=0.95)
      // para que la fusión sea suave y continua.
      const badgeP = Math.min(1, Math.max(0, (p - 0.80) / 0.20));
      badge.style.opacity = this.easeIn(badgeP).toFixed(4);
    };

    window.addEventListener('scroll', this.scrollListener, { passive: true });
    this.scrollListener();
  }

  private applyFull(
    logo: HTMLElement, name: HTMLElement,
    nameSub: HTMLElement | undefined,
    badge: HTMLElement, overlay: HTMLElement,
  ): void {
    logo.style.visibility   = 'hidden';
    logo.style.transform    = 'none';
    name.style.visibility   = 'hidden';
    name.style.transform    = 'none';
    if (nameSub) {
      nameSub.style.visibility = 'hidden';
      nameSub.style.transform  = 'none';
    }
    badge.style.opacity         = '1';
    overlay.style.background    = 'transparent';
    overlay.style.pointerEvents = 'none';
  }

  private easeInOut(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  private easeIn(t: number): number { return t * t; }

  // ── OLAS ──────────────────────────────────────────────────────
  private initWaveObserver(): void {
    const waveWrap = document.querySelector('.iest-wave-wrap') as HTMLElement | null;
    const el = this.footerEl?.nativeElement;
    if (!el || !waveWrap) return;

    this.waveObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        waveWrap.classList.add('is-visible');
        this.waveObserver.disconnect();
      }
    }, { threshold: 0.05 });

    this.waveObserver.observe(el);
  }

  // ── DATOS ─────────────────────────────────────────────────────
  async cargarContacto(): Promise<void> {
    this.cargandoContacto = true;
    try {
      const res: any = await firstValueFrom(this.contactService.getPublicContactInfo());
      const data = res && typeof res === 'object' ? res : {};
      if (data.estado === 'Activo') {
        this.contacto = {
          telefono: data.telefono ?? '', correo: data.correo ?? '',
          direccion: data.direccion ?? '', horario: data.horario ?? '',
          facebook: data.facebook ?? '', instagram: data.instagram ?? '',
          twitter: data.twitter ?? '', whatsapp: data.whatsapp ?? '',
        };
      }
    } catch (err) { console.error('[Footer]', err); }
    finally { this.cargandoContacto = false; this.cdr.detectChanges(); }
  }

  normalizePhone(p: string): string { return p ? p.replace(/\D/g, '') : ''; }
}