import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CartService {

  private items: any[] = [];
  private cartSubject = new BehaviorSubject<any[]>([]);
  cart$ = this.cartSubject.asObservable();

  constructor() {
    this.loadCart();
  }

  // 🔥 Cargar carrito al iniciar
  private loadCart() {
    const saved = localStorage.getItem('cart');
    if (saved) {
      this.items = JSON.parse(saved);
      this.cartSubject.next(this.items);
    }
  }

  // 🔥 Guardar en localStorage
  private saveCart() {
    localStorage.setItem('cart', JSON.stringify(this.items));
  }

  add(item: any) {

    const existing = this.items.find(i => i.id === item.id);

    if (existing) {
      existing.quantity += 1;
    } else {
      this.items.push(item);
    }

     localStorage.setItem('cart', JSON.stringify(this.items));
      this.cartSubject.next(this.items);
  }

  remove(id: number) {
    this.items = this.items.filter(i => i.id !== id);
    this.saveCart();
    this.cartSubject.next(this.items);
  }

  clear() {
    this.items = [];
    this.saveCart();
    this.cartSubject.next(this.items);
  }

  getItems() {
    return this.items;
  }
}