import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation,inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MagazinesService } from '../../api/services/magazines.service';
import { CartService } from '../../api/services/cart.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { HttpHeaders } from '@angular/common/http'
import { environment } from '../../../app/api/environments/environment.prod';
import { FormsModule } from '@angular/forms';
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

    // ✅ inject() en lugar de constructor
  private magazineService = inject(MagazinesService);
  private cartService = inject(CartService);
  private http = inject(HttpClient);

  magazines: any[] = [];
  loading = true;
  cartCount = 0;
  cartOpen = false;
  cartItems: any[] = [];
  total = 0;
  paymentSuccess = false;
  paymentRejected = false;
  processingPayment = false;
  purchasedIds: number[] = [];
  purchasedMagazines: any[] = [];
  searchTerm = '';
  sortOrder = '';
  selectedLetter = '';
  alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  sortAlpha = '';        // A-Z / Z-A
  sortPrice = '';        // precio asc/desc
  filterOpen = {
    orden: true,
    precio: true,
    letra: true
  };

  

  constructor(
  
  ) {}

  ngOnInit(): void {
    this.loadMagazines();
    this.updateCart();

    this.cartService.cart$.subscribe(() => {
      this.updateCart();
    });

    this.cartService.cart$.subscribe(cart => {
      this.cartCount = cart.length;
    });
  }

  loadPurchases() {
    this.http.get<any[]>(
      `${environment.apiUrl}/magazines/my-purchases`
    ).subscribe(data => {
      this.purchasedMagazines = data;
    });
  }

  loadMagazines() {
    this.magazineService.getCatalog().subscribe((res: any) => {
      this.magazines = res.data;
      this.loading = false;
    });
  }

  toggleCart() {
    this.cartOpen = !this.cartOpen;
  }

  toggleFilter(section: 'orden' | 'precio' | 'letra') {
    this.filterOpen[section] = !this.filterOpen[section];
  }

  clearFilters() {
    this.sortOrder = '';
    this.sortAlpha = '';
    this.sortPrice = '';
    this.selectedLetter = '';
    this.searchTerm = '';
    this.loadMagazines();
  }
  closeCart() {
    this.cartOpen = false;
  }


  applyFilters() {
    this.magazineService.getFiltered({
      search: this.searchTerm,
      sort: this.sortOrder || this.sortAlpha || this.sortPrice,
      letter: this.selectedLetter
    }).subscribe((res: any) => {
      this.magazines = res.data;
    });
  }

  filterByLetter(letter: string) {
    this.selectedLetter = letter;
    this.applyFilters();
  }

  private getAuthHeaders() {
    //const token = localStorage.getItem('accessToken');
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  updateCart() {
    this.cartItems = this.cartService.getItems();
    this.cartCount = this.cartItems.length;
    this.total = this.cartItems.reduce((sum, item) => {
      return sum + (Number(item.precio) || 0);
    }, 0);
  }

  removeItem(id: number) {
    this.cartService.remove(id);
    this.updateCart();
  }

 simulatePayment() {
  if (this.cartItems.length === 0) return;

  this.processingPayment = true;
  const aprobado = Math.random() > 0.2;

  setTimeout(() => {
    if (!aprobado) {
      this.processingPayment = false;
      this.paymentRejected = true;
      return;
    }

     this.magazineService.savePurchase(this.cartItems)

      .subscribe({
        next: () => {
          this.processingPayment = false;
          this.paymentSuccess = true;
          this.cartService.clear();
          this.updateCart();
        },
        error: (err) => {
          console.log("Error backend:", err);
          this.processingPayment = false;
          this.paymentRejected = true;
        }
      });
  }, 1500);
}

  isPurchased(id: number): boolean {
    return this.purchasedIds.includes(id);
  }

  getPdfCover(publicId: string): string {
    if (!publicId) return 'assets/no-image.png';
    const cleanId = publicId.replace('.pdf', '');
    return `https://res.cloudinary.com/dtfto3sgm/image/upload/pg_1,w_300,h_400,c_fill/${cleanId}.jpg`;
  }

  addToCart(magazine: any) {
    this.cartService.add({
      id: magazine.id_magazine,
      titulo: magazine.titulo,
      precio: Number(magazine.precio),
      quantity: 1
    });
    this.updateCart();
  }
}

