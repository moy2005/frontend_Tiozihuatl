import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminDiscount,
  AdminDiscountPayload,
  AdminDiscountsService,
} from '../../../api/services/admin-discounts.service';
import { MagazinesService } from '../../../api/services/magazines.service';

@Component({
  selector: 'app-gestion-descuentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion-descuentos.component.html',
  styleUrls: ['./gestion-descuentos.component.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GestionDescuentosComponent implements OnInit {
  discounts: AdminDiscount[] = [];
  magazines: any[] = [];
  loading = false;
  saving = false;
  showModal = false;
  editingId: number | null = null;

  form: AdminDiscountPayload = this.emptyForm();

  constructor(
    private discountsService: AdminDiscountsService,
    private magazinesService: MagazinesService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  get activeDiscounts(): number {
    return this.discounts.filter(d => d.estado === 'Activo').length;
  }

  loadData(): void {
    this.loading = true;
    this.discountsService.getAll().subscribe({
      next: (discounts) => {
        this.discounts = discounts;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando descuentos:', err);
        this.loading = false;
      }
    });

    this.magazinesService.getAll().subscribe({
      next: (magazines) => {
        this.magazines = magazines;
      },
      error: (err) => console.error('Error cargando revistas:', err)
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.showModal = true;
  }

  openEdit(discount: AdminDiscount): void {
    this.editingId = discount.id_descuento;
    this.form = {
      nombre: discount.nombre,
      tipo: discount.tipo,
      valor: Number(discount.valor),
      fecha_inicio: this.toDateInput(discount.fecha_inicio),
      fecha_fin: this.toDateInput(discount.fecha_fin),
      estado: discount.estado,
      revistas: [...(discount.revista_ids || [])],
    };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.saving = false;
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;

    const request = this.editingId
      ? this.discountsService.update(this.editingId, this.form)
      : this.discountsService.create(this.form);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.loadData();
      },
      error: (err) => {
        console.error('Error guardando descuento:', err);
        alert(err?.error?.error || 'No se pudo guardar el descuento.');
        this.saving = false;
      }
    });
  }

  toggleStatus(discount: AdminDiscount): void {
    this.discountsService.toggleStatus(discount.id_descuento).subscribe({
      next: () => this.loadData(),
      error: (err) => alert(err?.error?.error || 'No se pudo cambiar el estado.')
    });
  }

  toggleMagazine(id: number, checked: boolean): void {
    if (checked) {
      if (!this.form.revistas.includes(id)) this.form.revistas.push(id);
      return;
    }

    this.form.revistas = this.form.revistas.filter(item => item !== id);
  }

  isMagazineSelected(id: number): boolean {
    return this.form.revistas.includes(id);
  }

  discountLabel(discount: AdminDiscount): string {
    return discount.tipo === 'porcentaje'
      ? `${Number(discount.valor)}%`
      : this.money(discount.valor);
  }

  money(value: number | string): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  trackById(_index: number, discount: AdminDiscount): number {
    return discount.id_descuento;
  }

  private emptyForm(): AdminDiscountPayload {
    const today = new Date().toISOString().slice(0, 10);
    return {
      nombre: '',
      tipo: 'porcentaje',
      valor: 10,
      fecha_inicio: today,
      fecha_fin: today,
      estado: 'Activo',
      revistas: [],
    };
  }

  private toDateInput(value: string): string {
    return value ? String(value).slice(0, 10) : '';
  }
}
