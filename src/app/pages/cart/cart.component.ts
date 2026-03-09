import { Component, OnInit,CUSTOM_ELEMENTS_SCHEMA,ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService } from '../../api/services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css'],
  schemas:[CUSTOM_ELEMENTS_SCHEMA],
  encapsulation:ViewEncapsulation.None
})
export class CartComponent implements OnInit {

  items: any[] = [];
  total = 0;

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart() {
    this.items = this.cartService.getItems();
    this.calculateTotal();
  }

  removeItem(id: number) {
    this.cartService.remove(id);
    this.loadCart();
  }

  calculateTotal() {
    this.total = this.items.reduce((sum, item) => {
      return sum + (item.precio || 0) * item.quantity;
    }, 0);
  }

  checkout() {
    this.router.navigate(['/checkout']);
  }
}
