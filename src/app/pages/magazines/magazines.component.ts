import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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

  magazines: any[]         = [];
  loading                  = true;
  cartCount                = 0;
  cartOpen                 = false;
  cartItems: any[]         = [];
  total                    = 0;
  paymentSuccess           = false;
  paymentRejected          = false;
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
  itemsPerPage: number = 6;  
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
    this.loadPurchases();
  }

  loadPurchasedIds(): void {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;

    this.http.get<any[]>(
      `${environment.apiUrl}/magazines/my-purchases`,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (data) => {
        this.purchasedIds = data.map(m => m.id_revista ?? m.id_magazine);
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
      this.magazines = res.data;
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
    const yaEnCarrito = this.cartItems.some(i => i.id === magazine.id_magazine);
    if (yaEnCarrito) {
      this.showToast('warning', 'Ya en el carrito', `"${magazine.titulo}" ya fue agregado.`, 'cart-outline');
      return;
    }

    this.cartService.add({
      id:       magazine.id_magazine,
      titulo:   magazine.titulo,
      precio:   Number(magazine.precio),
      quantity: 1
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
      return this.magazines.filter(m => this.isPurchased(m.id_magazine));
    }
    return this.magazines;
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
    }).subscribe((res: any) => this.magazines = res.data);
  }
  

  /* ── Pago ── */
  simulatePayment(): void {
    if (this.cartItems.length === 0) return;

    this.processingPayment = true;
    const aprobado = Math.random() > 0.2;

    setTimeout(() => {
      if (!aprobado) {
        this.processingPayment = false;
        this.paymentRejected   = true;
        this.showToast('error', 'Pago rechazado', 'No se pudo procesar tu pago. Intenta de nuevo.', 'close-circle-outline');
        return;
      }

      this.magazineService.savePurchase(this.cartItems).subscribe({
        next: () => {
          this.processingPayment = false;
          this.paymentSuccess    = true;
          this.cartService.clear();
          this.updateCart();
          this.closeCart();
          this.showToast('success', '¡Compra exitosa!', 'Tus revistas están listas para leer.', 'bag-check-outline');
        },
        error: (err) => {
          console.error('Error backend:', err);
          this.processingPayment = false;
          this.paymentRejected   = true;
          this.showToast('error', 'Error en compra', 'Ocurrió un error al procesar tu compra.', 'alert-circle-outline');
        }
      });
    }, 1500);
  }

  /* ── Helpers ── */
  isPurchased(id: number): boolean {
    return this.purchasedIds.includes(id);
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
