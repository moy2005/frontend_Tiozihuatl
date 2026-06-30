import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  AdminPayment,
  AdminPaymentFilters,
  AdminPaymentStats,
  AdminPaymentsService,
} from '../../../api/services/admin-payments.service';

@Component({
  selector: 'app-gestion-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-pagos.component.html',
  styleUrls: ['./gestion-pagos.component.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GestionPagosComponent implements OnInit {
  payments: AdminPayment[] = [];
  stats: AdminPaymentStats = this.emptyStats();
  loading = false;
  filtrosExpandidos = true;

  filtros: AdminPaymentFilters = {
    estado: '',
    usuario: '',
    fecha_inicio: '',
    fecha_fin: '',
    limit: 200,
  };

  constructor(private paymentsService: AdminPaymentsService) {}

  ngOnInit(): void {
    this.loadPayments();
  }

  get filtrosActivos(): boolean {
    return Boolean(
      this.filtros.estado ||
      this.filtros.usuario ||
      this.filtros.fecha_inicio ||
      this.filtros.fecha_fin
    );
  }

  loadPayments(): void {
    this.loading = true;

    forkJoin({
      purchases: this.paymentsService.getPurchases(this.filtros),
      stats: this.paymentsService.getStats(this.filtros),
    }).subscribe({
      next: ({ purchases, stats }) => {
        this.payments = purchases;
        this.stats = stats || this.emptyStats();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando pagos:', error);
        this.payments = [];
        this.stats = this.emptyStats();
        this.loading = false;
      },
    });
  }

  limpiarFiltros(): void {
    this.filtros = {
      estado: '',
      usuario: '',
      fecha_inicio: '',
      fecha_fin: '',
      limit: 200,
    };
    this.loadPayments();
  }

  toggleFiltros(): void {
    this.filtrosExpandidos = !this.filtrosExpandidos;
  }

  estadoClass(estado: string): string {
    if (estado === 'aprobado') return 'badge-aprobado';
    if (estado === 'cancelado') return 'badge-cancelado';
    return 'badge-pendiente';
  }

  estadoLabel(estado: string): string {
    if (estado === 'aprobado') return 'Aprobado';
    if (estado === 'cancelado') return 'Cancelado';
    return 'Pendiente';
  }

  money(value: number | string | null | undefined): string {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(amount);
  }

  shortReference(reference: string | null): string {
    if (!reference) return 'Sin referencia';
    return reference.length > 28 ? `${reference.slice(0, 28)}...` : reference;
  }

  trackByCompra(_index: number, payment: AdminPayment): number {
    return payment.id_pago || payment.id_compra;
  }

  private emptyStats(): AdminPaymentStats {
    return {
      total_compras: 0,
      aprobadas: 0,
      pendientes: 0,
      canceladas: 0,
      ingresos: 0,
      descuentos: 0,
    };
  }
}
