import { Component, OnInit,CUSTOM_ELEMENTS_SCHEMA,ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';


interface StatCard {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  trend?: string;
  trendUp?: boolean;
}

interface QuickAction {
  label: string;
  icon: string;
  route: string;
  color: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class AdminDashboardComponent implements OnInit {
  currentDate: Date = new Date();
  userName: string = 'Administrador';

  stats: StatCard[] = [
    {
      title: 'Total Usuarios',
      value: 1248,
      icon: 'people',
      color: '#5ECFB1',
      trend: '+12%',
      trendUp: true
    },
    {
      title: 'Libros Registrados',
      value: 3456,
      icon: 'book',
      color: '#6C63FF',
      trend: '+8%',
      trendUp: true
    },
    {
      title: 'Revistas Activas',
      value: 248,
      icon: 'newspaper',
      color: '#FF6B9D',
      trend: '+5%',
      trendUp: true
    },
    {
      title: 'Contactos Pendientes',
      value: 23,
      icon: 'mail',
      color: '#FFA726',
      trend: '-3%',
      trendUp: false
    }
  ];

  quickActions: QuickAction[] = [
    { label: 'Nuevo Usuario', icon: 'person-add', route: '/admin/usuarios', color: '#5ECFB1' },
    { label: 'Añadir Libro', icon: 'add-circle', route: '/admin/libros', color: '#6C63FF' },
    { label: 'Nueva Revista', icon: 'document-text', route: '/admin/revistas', color: '#FF6B9D' },
    { label: 'Crear Noticia', icon: 'megaphone', route: '/admin/noticias', color: '#FFA726' }
  ];

  recentActivity = [
    { user: 'Juan Pérez', action: 'registró un nuevo libro', time: 'Hace 5 minutos', icon: 'book', color: '#6C63FF' },
    { user: 'María López', action: 'actualizó su perfil', time: 'Hace 15 minutos', icon: 'person', color: '#5ECFB1' },
    { user: 'Carlos Ruiz', action: 'envió un mensaje de contacto', time: 'Hace 1 hora', icon: 'mail', color: '#FFA726' },
    { user: 'Ana Martínez', action: 'publicó una nueva noticia', time: 'Hace 2 horas', icon: 'megaphone', color: '#FF6B9D' }
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    const userData = localStorage.getItem('usuario');
    if (userData) {
      const user = JSON.parse(userData);
      this.userName = user.nombre || 'Administrador';
    }
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  get greeting(): string {
    const hour = this.currentDate.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get formattedDate(): string {
    return this.currentDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}