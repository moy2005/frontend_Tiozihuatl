import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

type SidebarState = 'open' | 'collapsed' | 'hidden';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

// Medidas del collapsed nav
const ITEM_HEIGHT = 56;   // altura de cada item en px
const ITEM_GAP    = 8;    // gap entre items
const NOTCH_R     = 14;   // radio de la escotadura cóncava

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class AdminLayoutComponent implements OnInit {
  sidebarState: SidebarState = 'collapsed'; // Desktop arranca en collapsed
  isMobile = false;
  currentUser: any = null;

  // Para el label flotante con position:fixed
  hoveredItemIndex: number = -1;
  labelTop: number = 0;

  menuItems: MenuItem[] = [
    { label: 'Dashboard',  icon: 'ph-squares-four',    route: '/admin/dashboard' },
    { label: 'Usuarios',   icon: 'ph-users',           route: '/admin/usuarios' },
    { label: 'Preguntas',  icon: 'ph-question',        route: '/admin/preguntas' },
    { label: 'Contactos',  icon: 'ph-envelope',        route: '/admin/contactos', badge: 5 },
    { label: 'Noticias',   icon: 'ph-megaphone',       route: '/admin/noticias' },
    { label: 'Quienes Somos',   icon: 'ph ph-buildings',       route: '/admin/about' },
    { label: 'Libros',     icon: 'ph-books',           route: '/admin/libros' },
    { label: 'Calendario', icon: 'ph-calendar',        route: '/admin/calendario-admin' },
    { label: 'Revistas',   icon: 'ph-newspaper',       route: '/admin/revistas' },
    { label: 'Préstamos',  icon: 'ph-book-bookmark',   route: '/admin/prestamos' },
    { label: 'Respaldos',  icon: 'ph-download-simple', route: '/admin/backups' },
    { label: 'Monitoreo',  icon: 'ph-monitor',         route: '/admin/monitoreo' },
    { label: 'Mantenimiento', icon: 'ph-wrench', route: '/admin/mantenimiento' },
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    const userData = localStorage.getItem('usuario');
    if (userData) this.currentUser = JSON.parse(userData);
    this.checkScreenSize();
  }

  @HostListener('window:resize')
  onResize() { this.checkScreenSize(); }

  checkScreenSize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 1024;

    if (!wasMobile && this.isMobile) {
      this.sidebarState = 'hidden';
    } else if (wasMobile && !this.isMobile) {
      this.sidebarState = 'collapsed';
    }
  }

  toggleSidebar() {
    if (this.isMobile) {
      this.sidebarState = this.sidebarState === 'open' ? 'hidden' : 'open';
    } else {
      this.sidebarState = this.sidebarState === 'collapsed' ? 'hidden' : 'collapsed';
    }
  }

  showHiddenSidebar() {
    this.sidebarState = this.isMobile ? 'open' : 'collapsed';
  }

  closeSidebar() { if (this.isMobile) this.sidebarState = 'hidden'; }

  getToggleButtonIcon(): string {
    if (this.sidebarState === 'open') return 'ph-caret-left';
    if (this.sidebarState === 'collapsed') return 'ph-caret-right';
    return 'ph-list';
  }

  getToggleButtonTitle(): string {
    if (this.sidebarState === 'open') return 'Cerrar menú';
    if (this.sidebarState === 'collapsed') return 'Ocultar menú';
    return 'Mostrar menú';
  }

  getStateIndicatorClass(): string { return `state-${this.sidebarState}`; }

  isActiveRoute(route: string): boolean { return this.router.url.startsWith(route); }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.router.navigate(['/login']);
  }

  goToProfile() { this.router.navigate(['/perfil']); }

  onNavItemClick() { if (this.isMobile) this.sidebarState = 'hidden'; }

  // ─── Hover para label flotante fixed ───────────────────────────────────────

  onItemMouseEnter(event: MouseEvent, index: number) {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.labelTop = rect.top + rect.height / 2;
    this.hoveredItemIndex = index;
  }

  onItemMouseLeave() {
    this.hoveredItemIndex = -1;
  }

  // ─── SVG dinámico para collapsed ───────────────────────────────────────────

  getCollapsedNavHeight(): number {
    return this.menuItems.length * (ITEM_HEIGHT + ITEM_GAP);
  }

  getActiveIndex(): number {
    return this.menuItems.findIndex(item => this.router.url.startsWith(item.route));
  }

  getCollapsedSidebarPath(): string {
    const W = 80;
    const H = this.getCollapsedNavHeight();
    const R = 16;
    const NR = NOTCH_R;

    const activeIdx = this.getActiveIndex();

    if (activeIdx === -1) {
      return `M ${R} 0 L ${W-R} 0 Q ${W} 0 ${W} ${R} L ${W} ${H-R} Q ${W} ${H} ${W-R} ${H} L ${R} ${H} Q 0 ${H} 0 ${H-R} L 0 ${R} Q 0 0 ${R} 0 Z`;
    }

    const itemCenter  = activeIdx * (ITEM_HEIGHT + ITEM_GAP) + ITEM_HEIGHT / 2 + 4;
    const notchTop    = itemCenter - 30;
    const notchBottom = itemCenter + 30;

    return `M ${R} 0 L ${W-R} 0 Q ${W} 0 ${W} ${R} L ${W} ${notchTop-NR} Q ${W} ${notchTop} ${W-NR} ${notchTop} L ${W-NR} ${notchBottom} Q ${W} ${notchBottom} ${W} ${notchBottom+NR} L ${W} ${H-R} Q ${W} ${H} ${W-R} ${H} L ${R} ${H} Q 0 ${H} 0 ${H-R} L 0 ${R} Q 0 0 ${R} 0 Z`;
  }
}
