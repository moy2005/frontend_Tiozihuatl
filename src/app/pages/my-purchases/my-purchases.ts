import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MagazinesService, PurchasedMagazine } from '../../api/services/magazines.service';
import { PageHero } from '../../components/page-hero/page-hero';

@Component({
  selector: 'app-my-purchases',
  imports: [CurrencyPipe, DatePipe, RouterLink, PageHero],
  templateUrl: './my-purchases.html',
  styleUrl: './my-purchases.css',
})
export class MyPurchases implements OnInit {
  private readonly magazines = inject(MagazinesService);
  private readonly destroyRef = inject(DestroyRef);

  protected purchases: PurchasedMagazine[] = [];
  protected readonly failedCovers = new Set<number>();
  protected status: 'loading' | 'loaded' | 'error' = 'loading';

  ngOnInit(): void {
    this.loadPurchases();
  }

  protected loadPurchases(): void {
    this.status = 'loading';
    this.magazines.getMyPurchases().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (purchases) => {
        this.purchases = purchases;
        this.failedCovers.clear();
        this.status = 'loaded';
      },
      error: () => this.status = 'error',
    });
  }
}
