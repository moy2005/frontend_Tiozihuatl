import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../api/services/cart.service';
import { MagazinesService } from '../../api/services/magazines.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent {

  processing = false;

  constructor(
    private cartService: CartService,
    private magazineService: MagazinesService,
    private router: Router
  ) {}

  async pay() {

  this.processing = true;

  const items = this.cartService.getItems();

  this.magazineService.createPurchase(items)
    .subscribe({
      next: () => {

        this.cartService.clear();
        this.processing = false;

        this.router.navigate(['/perfil-usuario']);
      },
      error: () => {
        this.processing = false;
        alert('Error al procesar la compra');
      }
    });
}

}