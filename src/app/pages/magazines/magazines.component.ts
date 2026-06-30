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
    this.total     = this.cartItems.reduce((s, i) => s + (Number(i.precio) || 0), 0);
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
   if (this.cartItems.length === 0) return;
  this.processingPayment = true;

  this.magazineService.createCheckoutSession({
    items: this.cartItems.map(cartItem => ({
      id_revista: cartItem.id
    }))
  }).subscribe({
    next: (res: any) => {
      // 🔥 Redirige a Stripe
      window.location.href = res.url;
    },
    error: (err) => {
      console.error('Error Stripe:', err);
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
    const success = params.get('success') === 'true';
    const cancel = params.get('cancel') === 'true';
    const sessionId = params.get('session_id');

    if (!success && !cancel) return;

    if (success) {
      this.cartService.clear();
      this.updateCart();
      this.paymentSuccess = true;
      this.paymentRejected = false;
      this.showToast(
        'success',
        'Pago confirmado',
        'Estamos actualizando tus revistas adquiridas.',
        'checkmark-circle-outline'
      );
      this.loadPurchasedIds();
      if (sessionId) {
        this.refreshPaymentStatus(sessionId);
      } else {
        setTimeout(() => this.loadPurchasedIds(), 2500);
      }
    }

    if (cancel) {
      this.processingPayment = false;
      this.paymentRejected = true;
      this.paymentErrorMessage = 'El pago fue cancelado. No se realizo ningun cargo.';
      this.showToast(
        'info',
        'Pago cancelado',
        'Puedes intentarlo de nuevo cuando quieras.',
        'close-circle-outline'
      );
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
  }

  private refreshPaymentStatus(sessionId: string, attempt = 1): void {
    this.magazineService.getCheckoutSessionStatus(sessionId).subscribe({
      next: (status) => {
        if (status?.paid) {
          this.loadPurchasedIds();
          this.loadMagazines();
          return;
        }

        if (attempt < 5) {
          setTimeout(() => this.refreshPaymentStatus(sessionId, attempt + 1), 1500);
        }
      },
      error: () => {
        if (attempt < 3) {
          setTimeout(() => this.refreshPaymentStatus(sessionId, attempt + 1), 1500);
          return;
        }

        this.loadPurchasedIds();
      }
    });
  }

  /* ── Helpers ── */
  getMagazineId(magazine: any): number {
    return Number(magazine?.id_magazine ?? magazine?.id_revista ?? magazine?.magazine_id ?? magazine?.id);
  }

  isPurchased(id: number): boolean {
    return Number.isInteger(id) && this.purchasedIds.includes(id);
  }

  getFinalPrice(magazine: any): number {
    const finalPrice = Number(magazine?.precio_final);
    return Number.isFinite(finalPrice) ? finalPrice : Number(magazine?.precio || 0);
  }

  hasDiscount(magazine: any): boolean {
    return Boolean(Number(magazine?.descuento_activo)) &&
      this.getFinalPrice(magazine) < Number(magazine?.precio || 0);
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
