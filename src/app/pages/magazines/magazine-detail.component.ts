import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation,inject } from '@angular/core';
import { ActivatedRoute,Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { environment } from '../../api/environments/environment.prod';
import { CartService } from '../../api/services/cart.service';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
@Component({
  selector: 'app-magazine-detail',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './magazine-detail.component.html',
  styleUrls: ['./magazine-detail.component.css'],
  encapsulation: ViewEncapsulation.None,
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MagazineDetailComponent implements OnInit {


    // ✅ inject()
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private cartService = inject(CartService);
  private router = inject(Router);

  magazine: any;
  magazineId!: number;

  hasPurchased = false;

  showReader = false;
  safePdfUrl: any;
  showAddedMessage = false;

  constructor(
  ) {}

  ngOnInit(): void {
     if (typeof window === 'undefined') return; //guard SSR
    const id = this.route.snapshot.paramMap.get('id');

    if (!id || isNaN(Number(id))) {
      console.error("ID inválido");
      return;
    }

    this.magazineId = Number(id);

    this.loadMagazine();
  }

  getPdfCover(publicId: string) {
  return `https://res.cloudinary.com/dtfto3sgm/image/upload/${publicId}.jpg`;
}

  /* ==============================
     CARGAR INFORMACIÓN REVISTA
  ============================== */
  loadMagazine() {

    this.http.get<any>(
      `${environment.apiUrl}/magazines/${this.magazineId}`
    ).subscribe({
      next: (res) => {
        this.magazine = res.data || res;
        this.checkIfPurchased();
      },
      error: (err) => {
        console.error("Error cargando revista", err);
      }
    });

  }

/* ==============================
   VALIDAR SI FUE COMPRADA
============================== */
checkIfPurchased() {

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  if (!token) {
    console.warn("No hay token disponible");
    return;
  }

  this.http.get<any[]>(
    `${environment.apiUrl}/magazines/my-purchases`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  ).subscribe({
    next: (data) => {

      this.hasPurchased = data.some(
        m => m.id_revista == this.magazineId
      );

    },
    error: (err) => {
      console.error("Error validando compra", err);
    }
  });

}

  /* ==============================
     AGREGAR AL CARRITO
  ============================== */
addToCart() {

  if (!this.magazine) return;

  this.cartService.add({
    id: this.magazine.id_revista,
    titulo: this.magazine.titulo,
    precio: this.magazine.precio,
    quantity: 1
  });

  this.showAddedMessage = true;

  setTimeout(() => {
    this.showAddedMessage = false;
  }, 2000);
}

  /* ==============================
     ABRIR LECTOR (SI COMPRADA)
  ============================== */
  openReader() {
    if (!this.hasPurchased) {
      alert("Debes comprar esta revista primero 📚");
      return;
    }
    // 🔥 Redirigir al visor propio en lugar de iframe
    this.router.navigate(['/magazines/view', this.magazineId]);
  }
}
