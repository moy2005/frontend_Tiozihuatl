import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../api/environments/environment.prod';

@Component({
  selector: 'app-my-purchases',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-purchases.html',
  styleUrls: ['./my-purchases.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  encapsulation: ViewEncapsulation.None
})
export class MyPurchases implements OnInit {
  purchasedMagazines: any[] = [];
  loadingPurchases = false;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarRevistasCompradas();
  }

  cargarRevistasCompradas() {
    this.loadingPurchases = true;
    this.http.get<any[]>(`${environment.apiUrl}/magazines/my-purchases`).subscribe({
      next: (data) => {
        this.purchasedMagazines = data;
        this.loadingPurchases = false;
      },
      error: () => {
        this.loadingPurchases = false;
      }
    });
  }

  irALectura(idRevista: number) {
    this.router.navigate(['/magazines/view', idRevista]);
  }
}