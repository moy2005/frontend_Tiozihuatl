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
  sidebarState: SidebarState = 'open';
  isMobile = false;
  currentUser: any = null;

  menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'grid-outline',
      route: '/admin/dashboard'
    },
    {
      label: 'Usuarios',
      icon: 'people-outline',
      route: '/admin/usuarios'
    },
    {
      label: 'Preguntas',
      icon: 'help-circle-outline',
      route: '/admin/preguntas'
    },
    {
      label: 'Contactos',
      icon: 'mail-outline',
      route: '/admin/contactos',
      badge: 5
    },
    {
      label: 'Libros',
      icon: 'book-outline',
      route: '/admin/libros'
    },
    {
      label: 'Revistas',
      icon: 'newspaper-outline',
      route: '/admin/revistas'
    },
    {
    label: 'Quiénes Somos',
    icon: 'information-circle-outline',
    route: '/admin/about'
    },
    {
      label: 'Noticias',
      icon: 'megaphone-outline',
      route: '/admin/noticias'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    // Obtener datos del usuario desde localStorage o servicio
    const userData = localStorage.getItem('usuario');
    if (userData) {
      this.currentUser = JSON.parse(userData);
    }

    // Verificar si es móvil al cargar
    this.checkScreenSize();
    
    // En mobile, sidebar oculto por defecto
    if (this.isMobile) {
      this.sidebarState = 'hidden';
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 1024;
    
    // Si cambió de desktop a móvil, ocultar sidebar
    if (!wasMobile && this.isMobile) {
      this.sidebarState = 'hidden';
    }
    // Si cambió de móvil a desktop, abrir sidebar (si estaba oculto)
    else if (wasMobile && !this.isMobile && this.sidebarState === 'hidden') {
      this.sidebarState = 'open';
    }
  }

  toggleSidebar() {
    // Ciclo: open -> collapsed -> hidden -> open
    if (this.sidebarState === 'open') {
      this.sidebarState = 'collapsed';
    } else if (this.sidebarState === 'collapsed') {
      this.sidebarState = 'hidden';
    } else {
      this.sidebarState = 'open';
    }
  }

  showHiddenSidebar() {
    // Botón especial para mostrar sidebar cuando está completamente oculto
    if (this.isMobile) {
      this.sidebarState = 'open';
    } else {
      this.sidebarState = 'open';
    }
  }

  closeSidebar() {
    // Solo cerrar completamente en móvil
    if (this.isMobile) {
      this.sidebarState = 'hidden';
    }
  }

  getToggleButtonIcon(): string {
    if (this.sidebarState === 'open') {
      return 'chevron-back-outline';
    } else if (this.sidebarState === 'collapsed') {
      return 'chevron-forward-outline';
    } else {
      return 'menu-outline';
    }
  }

  getToggleButtonTitle(): string {
    if (this.sidebarState === 'open') {
      return 'Contraer menú';
    } else if (this.sidebarState === 'collapsed') {
      return 'Ocultar menú';
    } else {
      return 'Mostrar menú';
    }
  }

  getStateIndicatorClass(): string {
    return `state-${this.sidebarState}`;
  }

  isActiveRoute(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.router.navigate(['/login']);
  }

  goToProfile() {
    this.router.navigate(['/perfil']);
  }

  // Método para manejar clics en items del menú
  onNavItemClick() {
    // En móvil, ocultar el sidebar después de hacer clic
    if (this.isMobile) {
      this.sidebarState = 'hidden';
    }
  }
}