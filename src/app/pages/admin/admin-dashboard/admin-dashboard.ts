import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

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
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  currentDate: Date = new Date();
  userName: string = 'Administrador';

  // Charts instances
  private barChart?: Chart;
  private doughnutChart?: Chart;
  private progressChart?: Chart;
  private areaChart?: Chart;
  private lineChart?: Chart;
  private overviewChart?: Chart;

  stats: StatCard[] = [
    {
      title: 'Total Usuarios',
      value: 1248,
      icon: 'people',
      color: '#1E88E5',
      trend: '+12%',
      trendUp: true
    },
    {
      title: 'Libros Registrados',
      value: 3456,
      icon: 'book',
      color: '#3FA6E8',
      trend: '+8%',
      trendUp: true
    },
    {
      title: 'Revistas Activas',
      value: 248,
      icon: 'newspaper',
      color: '#0D47A1',
      trend: '+5%',
      trendUp: true
    },
    {
      title: 'Mensajes Pendientes',
      value: 23,
      icon: 'mail',
      color: '#64B5F6',
      trend: '-3%',
      trendUp: false
    }
  ];

  quickActions: QuickAction[] = [
    { label: 'Nuevo Usuario', icon: 'person-add', route: '/admin/usuarios', color: '#1E88E5' },
    { label: 'Añadir Libro', icon: 'add-circle', route: '/admin/libros', color: '#3FA6E8' },
    { label: 'Nueva Revista', icon: 'document-text', route: '/admin/revistas', color: '#0D47A1' },
    { label: 'Crear Noticia', icon: 'megaphone', route: '/admin/noticias', color: '#64B5F6' }
  ];

  recentActivity = [
    { user: 'Juan Pérez', action: 'registró un nuevo libro', time: 'Hace 5 minutos', icon: 'book', color: '#3FA6E8' },
    { user: 'María López', action: 'actualizó su perfil', time: 'Hace 15 minutos', icon: 'person', color: '#1E88E5' },
    { user: 'Carlos Ruiz', action: 'envió un mensaje de contacto', time: 'Hace 1 hora', icon: 'mail', color: '#64B5F6' },
    { user: 'Ana Martínez', action: 'publicó una nueva noticia', time: 'Hace 2 horas', icon: 'megaphone', color: '#0D47A1' }
  ];

  constructor(private router: Router) {}

  ngOnInit() {
    const userData = localStorage.getItem('usuario');
    if (userData) {
      const user = JSON.parse(userData);
      this.userName = user.nombre || 'Administrador';
    }
  }

  ngAfterViewInit() {
    // Inicializar todos los gráficos después de que la vista esté lista
    setTimeout(() => {
      this.initBarChart();
      this.initDoughnutChart();
      this.initProgressChart();
      this.initAreaChart();
      this.initLineChart();
      this.initOverviewChart();
    }, 100);
  }

  ngOnDestroy() {
    // Destruir todas las instancias de charts para evitar memory leaks
    this.barChart?.destroy();
    this.doughnutChart?.destroy();
    this.progressChart?.destroy();
    this.areaChart?.destroy();
    this.lineChart?.destroy();
    this.overviewChart?.destroy();
  }

  // Configuración común para todos los charts
  private getCommonOptions() {
    Chart.defaults.font.family = "'Outfit', sans-serif";
    Chart.defaults.font.size = 13;
    Chart.defaults.color = '#64748B';
  }

  private initBarChart() {
    const canvas = document.getElementById('barChart') as HTMLCanvasElement;
    if (!canvas) return;

    this.getCommonOptions();

    const config: any = {
      type: 'bar',
      data: {
        labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
        datasets: [
          {
            label: 'Libros',
            data: [245, 312, 289, 356, 298, 267, 334, 402, 378, 425, 389, 456],
            backgroundColor: '#3FA6E8',
            borderRadius: 8,
            barThickness: 26
          },
          {
            label: 'Revistas',
            data: [18, 22, 19, 25, 21, 16, 23, 28, 24, 31, 26, 34],
            backgroundColor: '#1E88E5',
            borderRadius: 8,
            barThickness: 26
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#2C3E50',
            padding: 14,
            cornerRadius: 10,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF'
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { 
              font: { weight: 600, size: 12 }, 
              color: '#7B8794' 
            }
          },
          y: {
            grid: { 
              color: '#E8EDF1', 
              drawBorder: false 
            },
            ticks: { 
              font: { weight: 600, size: 12 }, 
              color: '#7B8794' 
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutCubic'
        }
      }
    };

    this.barChart = new Chart(canvas, config);
  }

  private initDoughnutChart() {
    const canvas = document.getElementById('doughnutChart') as HTMLCanvasElement;
    if (!canvas) return;

    const config: any = {
      type: 'doughnut',
      data: {
        labels: ['Activos', 'Inactivos', 'Nuevos'],
        datasets: [{
          data: [842, 256, 150],
          backgroundColor: ['#3FA6E8', '#5CB8F0', '#2B8FD9'],
          borderWidth: 0,
          cutout: '65%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 14,
              font: { size: 11, weight: 600 },
              usePointStyle: true,
              pointStyle: 'circle',
              color: '#546E7A'
            }
          },
          tooltip: {
            backgroundColor: '#2C3E50',
            padding: 12,
            cornerRadius: 8,
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF'
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 1500
        }
      }
    };

    this.doughnutChart = new Chart(canvas, config);
  }

  private initProgressChart() {
    const canvas = document.getElementById('progressChart') as HTMLCanvasElement;
    if (!canvas) return;

    const completionRate = 67;

    const config: any = {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [completionRate, 100 - completionRate],
          backgroundColor: ['#3FA6E8', '#EBF5FB'],
          borderWidth: 0,
          cutout: '75%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        animation: {
          animateRotate: true,
          duration: 1500
        }
      },
      plugins: [{
        id: 'centerText',
        afterDraw: (chart: any) => {
          const ctx = chart.ctx;
          ctx.save();
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
          ctx.font = 'bold 34px Inter';
          ctx.fillStyle = '#2C3E50';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(completionRate + '%', centerX, centerY);
          ctx.font = '600 12px Inter';
          ctx.fillStyle = '#7B8794';
          ctx.fillText('Completado', centerX, centerY + 25);
          ctx.restore();
        }
      }]
    };

    this.progressChart = new Chart(canvas, config);
  }

  private initAreaChart() {
    const canvas = document.getElementById('areaChart') as HTMLCanvasElement;
    if (!canvas) return;

    const config: any = {
      type: 'line',
      data: {
        labels: Array.from({ length: 30 }, (_, i) => i + 1),
        datasets: [
          {
            label: 'Libros',
            data: [1200, 1450, 1380, 1590, 1520, 1680, 1640, 1820, 1750, 1950, 1890, 2100, 2050, 2240, 2180, 2350, 2290, 2480, 2420, 2610, 2550, 2740, 2680, 2850, 2790, 2920, 2860, 2980, 2940, 3100],
            backgroundColor: 'rgba(63, 166, 232, 0.25)',
            borderColor: '#3FA6E8',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0
          },
          {
            label: 'Revistas',
            data: [890, 1020, 950, 1140, 1070, 1250, 1180, 1360, 1290, 1480, 1410, 1590, 1520, 1690, 1620, 1780, 1710, 1860, 1790, 1940, 1870, 2010, 1950, 2120, 2050, 2190, 2130, 2260, 2200, 2340],
            backgroundColor: 'rgba(30, 136, 229, 0.15)',
            borderColor: '#1E88E5',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 11, weight: 600 },
              color: '#FFFFFF',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(44, 62, 80, 0.95)',
            padding: 12,
            cornerRadius: 8,
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF'
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: {
              color: 'rgba(255, 255, 255, 0.9)',
              font: { weight: 600, size: 10 },
              maxTicksLimit: 15
            }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            ticks: {
              color: 'rgba(255, 255, 255, 0.9)',
              font: { weight: 600, size: 10 }
            }
          }
        },
        animation: {
          duration: 1800,
          easing: 'easeInOutCubic'
        }
      }
    };

    this.areaChart = new Chart(canvas, config);
  }

  private initLineChart() {
    const canvas = document.getElementById('lineChart') as HTMLCanvasElement;
    if (!canvas) return;

    const config: any = {
      type: 'line',
      data: {
        labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'],
        datasets: [
          {
            label: 'Usuarios Activos',
            data: [420, 680, 850, 620, 920, 780, 1050, 890, 640, 870, 750, 1240, 1380, 1520],
            borderColor: '#3FA6E8',
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#3FA6E8',
            pointHoverBorderColor: 'white',
            pointHoverBorderWidth: 3
          },
          {
            label: 'Contenido Publicado',
            data: [320, 480, 620, 450, 780, 650, 840, 520, 690, 730, 580, 920, 860, 1020],
            borderColor: '#1E88E5',
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#1E88E5',
            pointHoverBorderColor: 'white',
            pointHoverBorderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 12, weight: 600 },
              color: '#546E7A',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: '#2C3E50',
            padding: 14,
            cornerRadius: 10,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF'
          }
        },
        scales: {
          x: {
            grid: { color: '#E8EDF1', drawBorder: false },
            ticks: { 
              font: { weight: 600, size: 11 }, 
              color: '#7B8794' 
            }
          },
          y: {
            grid: { color: '#E8EDF1', drawBorder: false },
            ticks: {
              font: { weight: 600, size: 11 },
              color: '#7B8794',
              callback: (value: any) => value >= 1000 ? (value / 1000) + 'k' : value
            },
            max: 1600
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 1800,
          easing: 'easeInOutCubic'
        }
      }
    };

    this.lineChart = new Chart(canvas, config);
  }

  private initOverviewChart() {
    const canvas = document.getElementById('overviewChart') as HTMLCanvasElement;
    if (!canvas) return;

    const config: any = {
      type: 'bar',
      data: {
        labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
        datasets: [
          {
            label: 'Nuevos Usuarios',
            data: [145, 189, 223, 267],
            backgroundColor: '#3FA6E8',
            borderRadius: 8,
            barThickness: 40
          },
          {
            label: 'Libros Añadidos',
            data: [89, 112, 134, 156],
            backgroundColor: '#1E88E5',
            borderRadius: 8,
            barThickness: 40
          },
          {
            label: 'Revistas Publicadas',
            data: [12, 18, 15, 21],
            backgroundColor: '#0D47A1',
            borderRadius: 8,
            barThickness: 40
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 12, weight: 600 },
              color: '#546E7A',
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: '#2C3E50',
            padding: 14,
            cornerRadius: 10,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            titleColor: '#FFFFFF',
            bodyColor: '#FFFFFF'
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { 
              font: { weight: 600, size: 12 }, 
              color: '#7B8794' 
            }
          },
          y: {
            grid: { 
              color: '#E8EDF1', 
              drawBorder: false 
            },
            ticks: { 
              font: { weight: 600, size: 12 }, 
              color: '#7B8794' 
            }
          }
        },
        animation: {
          duration: 1800,
          easing: 'easeInOutCubic'
        }
      }
    };

    this.overviewChart = new Chart(canvas, config);
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