import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MagazinesService } from '../../api/services/magazines.service';
import { CartService } from '../../api/services/cart.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http';
import { environment } from '../../../app/api/environments/environment';
import { FormsModule } from '@angular/forms';

/* ── Toast ── */
interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  icon: string;
}

@Component({
  selector: 'app-magazines',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, FormsModule],
  templateUrl: './magazines.component.html',
  styleUrls: ['./magazines.component.css'], 
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class MagazinesComponent implements OnInit {

  private magazineService = inject(MagazinesService);
  private cartService     = inject(CartService);
  private http            = inject(HttpClient);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);

  magazines: any[]         = [];
  loading                  = true;
  cartCount                = 0;
  cartOpen                 = false;
  cartItems: any[]         = [];
  total                    = 0;
  paymentSuccess           = false;
  paymentRejected          = false;
  paymentErrorMessage      = 'No se pudo iniciar el pago';
  processingPayment        = false;
  purchasedIds: number[]   = [];
  purchasedMagazines: any[]= [];
  searchTerm               = '';
  sortOrder                = '';
  selectedLetter           = '';
  alphabet                 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  sortAlpha                = '';
  sortPrice                = '';
  cartAddedMagazine: any = null;  // revista recién agregada
  showCartModal = false;           // controla el modal
  currentPage: number = 1;
  itemsPerPage: number = 9999;  
  activeTab: 'all' | 'purchased' = 'all';
  filterOpen = { orden: true, precio: true, letra: true };
  readonly mercadoPagoFeeEstimate = 5.25;

  /* ── Toasts ── */
  toasts: Toast[]  = [];
  private toastId  = 0;

  constructor() {}

  ngOnInit(): void {
    this.loadMagazines();
    this.updateCart();
    this.cartService.cart$.subscribe(() => this.updateCart());
    this.cartService.cart$.subscribe(cart => this.cartCount = cart.length);
    this.loadPurchasedIds();
    this.handlePaymentReturn();
  }

  loadPurchasedIds(): void {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    this.http.get<any[]>(
      `${environment.apiUrl}/magazines/my-purchases`,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (data) => {
        console.log('Compras:', data); // 👈 DEBUG

        this.purchasedIds = data
          .map(m => this.getMagazineId(m))
          .filter((id): id is number => Number.isInteger(id));

        this.removePurchasedItemsFromCart();
      },
      error: (err) => console.error('Error cargando compras', err)
    });
}
  /* ── Toast helper ── */
  showToast(type: Toast['type'], title: string, message: string, icon: string): void {
    const id = ++this.toastId;
    this.toasts.push({ id, type, title, message, icon });
    setTimeout(() => this.removeToast(id), 3500);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  /* ── Datos ── */
  loadPurchases(): void {
    this.http.get<any[]>(`${environment.apiUrl}/magazines/my-purchases`)
      .subscribe(data => this.purchasedMagazines = data);
  }

  loadMagazines(): void {
    this.magazineService.getCatalog().subscribe((res: any) => {
      this.magazines = this.sortMagazines(res.data || []);
      this.loading   = false;
    });
  }

  /* ── Carrito ── */
  toggleCart(): void { this.cartOpen = !this.cartOpen; }
  closeCart():  void { this.cartOpen = false; }

  updateCart(): void {
    this.cartItems = this.cartService.getItems();
    this.cartCount = this.cartItems.length;
    this.total     = Number(this.cartItems.reduce((s, i) => s + (Number(i.precio) || 0), 0).toFixed(2));
  }

  addToCart(magazine: any): void {
    const magazineId = this.getMagazineId(magazine);

    if (!magazineId) return;

    if (this.isPurchased(magazineId)) {
      this.showToast('info', 'Ya adquirida', `"${magazine.titulo}" ya esta en tus revistas.`, 'checkmark-circle-outline');
      return;
    }

    const yaEnCarrito = this.cartItems.some(i => i.id === magazineId);
    if (yaEnCarrito) {
      this.showToast('warning', 'Ya en el carrito', `"${magazine.titulo}" ya fue agregado.`, 'cart-outline');
      return;
    }

    this.cartService.add({
      id:          magazineId,
      titulo:      magazine.titulo,
      precio:      this.getFinalPrice(magazine),
      precio_base: Number(magazine.precio),
      quantity:    1
    });
    this.updateCart();

    // ✅ Muestra modal central en lugar del toast
    this.cartAddedMagazine = magazine;
    this.showCartModal = true;
    setTimeout(() => this.showCartModal = false, 3000); // se cierra solo en 3s
  }

  removeItem(id: number): void {
    const item = this.cartItems.find(i => i.id === id);
    this.cartService.remove(id);
    this.updateCart();
    if (item) {
      this.showToast('info', 'Eliminado', `"${item.titulo}" fue removido del carrito.`, 'trash-outline');
    }
  }

  /* ── Filtros ── */
  toggleFilter(section: 'orden' | 'precio' | 'letra'): void {
    this.filterOpen[section] = !this.filterOpen[section];
  }
  get displayedMagazines(): any[] {
    if (this.activeTab === 'purchased') {
      return this.magazines.filter(m => this.isPurchased(this.getMagazineId(m)));
    }
    return this.magazines;
  }

  get purchasedVisibleCount(): number {
    return this.magazines.filter(m => this.isPurchased(this.getMagazineId(m))).length;
  }

  setTab(tab: 'all' | 'purchased') {
    this.activeTab = tab;
    this.currentPage = 1;
  }
  clearFilters(): void {
    this.sortOrder = ''; this.sortAlpha = ''; this.sortPrice = '';
    this.selectedLetter = ''; this.searchTerm = '';
    this.loadMagazines();
  }

  applyFilters(): void {
    this.magazineService.getFiltered({
      search: this.searchTerm,
      sort:   this.sortOrder || this.sortAlpha || this.sortPrice,
      letter: this.selectedLetter
    }).subscribe((res: any) => this.magazines = this.sortMagazines(res.data || []));
  }
  

  /* ── Pago ── */
simulatePayment(): void {
  if (this.cartItems.length === 0 || this.processingPayment) return;

  if (this.removePurchasedItemsFromCart()) {
    this.showToast(
      'info',
      'Carrito actualizado',
      'Quitamos revistas que ya estaban adquiridas.',
      'checkmark-circle-outline'
    );
    return;
  }

  this.processingPayment = true;

  this.magazineService.createPaymentPreference({
    items: this.cartItems.map(cartItem => ({
      id_revista: cartItem.id
    }))
  }).subscribe({
    next: (res: any) => {
      const paymentUrl = res?.init_point || res?.sandbox_init_point;
      if (!paymentUrl) {
        this.processingPayment = false;
        this.paymentRejected = true;
        this.paymentErrorMessage = 'Mercado Pago no devolvio una URL de pago.';
        this.showToast('error', 'Error en pago', this.paymentErrorMessage, 'alert-circle-outline');
        return;
      }
      window.location.href = paymentUrl;
    },
    error: (err) => {
      console.error('Error Mercado Pago:', err);
      const message = err?.error?.error || err?.error?.message || 'No se pudo iniciar el pago';
      this.processingPayment = false;
      this.paymentRejected = true;
      this.paymentErrorMessage = message;
      this.showToast(
        'error',
        'Error en pago',
        message,
        'alert-circle-outline'
      );
    }
  });
}

  private handlePaymentReturn(): void {
    const params = this.route.snapshot.queryParamMap;
    const payment = params.get('payment');
    const status = params.get('status');
    const success = payment === 'success' || status === 'approved';
    const failure = payment === 'failure' || status === 'rejected' || status === 'cancelled';
    const pending = payment === 'pending' || status === 'pending' || status === 'in_process';

    if (!success && !failure && !pending) return;

    if (success) {
      this.cartService.clear();
      this.updateCart();
      this.processingPayment = false;
      this.paymentSuccess = true;
      this.paymentRejected = false;
      this.showToast(
        'success',
        'Pago confirmado',
        'Estamos actualizando tus revistas adquiridas.',
        'checkmark-circle-outline'
      );
      this.loadPurchasedIds();
      setTimeout(() => {
        this.loadPurchasedIds();
        this.loadMagazines();
      }, 2500);
    }

    if (failure) {
      this.processingPayment = false;
      this.paymentRejected = true;
      this.paymentErrorMessage = 'El pago fue rechazado o cancelado. No se realizo ningun cargo.';
      this.showToast(
        'info',
        'Pago no completado',
        'Puedes intentarlo de nuevo cuando quieras.',
        'close-circle-outline'
      );
    }

    if (pending) {
      this.processingPayment = false;
      this.showToast(
        'info',
        'Pago pendiente',
        'Mercado Pago esta confirmando tu pago. Tus revistas apareceran cuando se apruebe.',
        'time-outline'
      );
      setTimeout(() => {
        this.loadPurchasedIds();
        this.loadMagazines();
      }, 3000);
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  /* Helpers */
  getMagazineId(magazine: any): number {
    return Number(magazine?.id_magazine ?? magazine?.id_revista ?? magazine?.magazine_id ?? magazine?.id);
  }

  isPurchased(id: number): boolean {
    return Number.isInteger(id) && this.purchasedIds.includes(id);
  }

  private removePurchasedItemsFromCart(): boolean {
    const purchasedInCart = this.cartItems.filter(item => this.isPurchased(Number(item.id)));

    if (purchasedInCart.length === 0) return false;

    for (const item of purchasedInCart) {
      this.cartService.remove(Number(item.id));
    }

    this.updateCart();
    return true;
  }

  getFinalPrice(magazine: any): number {
    const finalPrice = Number(magazine?.precio_final);
    return Number.isFinite(finalPrice) ? finalPrice : Number(magazine?.precio || 0);
  }

  hasDiscount(magazine: any): boolean {
    return Boolean(Number(magazine?.descuento_activo)) &&
      this.getFinalPrice(magazine) < Number(magazine?.precio || 0);
  }

  formatCurrency(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  get payDisabled(): boolean {
    return this.processingPayment;
  }

  getPdfCover(publicId: string): string {
    if (!publicId) return 'assets/no-image.png';
    const cleanId = publicId.replace('.pdf', '');
    return `https://res.cloudinary.com/dazzy4wzq/image/upload/pg_1,w_300,h_400,c_fill,f_jpg/${cleanId}`;
  }

  private getAuthHeaders(): HttpHeaders {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private sortMagazines(items: any[]): any[] {
    return [...items].sort((a, b) =>
      String(a?.titulo || '').localeCompare(String(b?.titulo || ''), 'es-MX', {
        numeric: true,
        sensitivity: 'base'
      })
    );
  }

  get paginatedMagazines() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.displayedMagazines.slice(start, start + this.itemsPerPage);
  }
  get totalPages(): number {
    return Math.ceil(this.displayedMagazines.length / this.itemsPerPage);
  }

  changePage(page: number) {
    this.currentPage = page;
  }

}
