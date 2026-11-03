import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, model, untracked,
} from '@angular/core';

type PageItem = number | 'gap-start' | 'gap-end';

/**
 * Paginación común del panel de administración (diseño de Gestión de catálogo).
 * Se enlaza en ambos sentidos con el estado de cada página:
 *   <app-admin-pagination [total]="lista.length" [(page)]="paginaActual" [(pageSize)]="itemsPorPagina" />
 * Corrige la página si el total disminuye (filtros, eliminaciones) y lleva la
 * vista al inicio del listado al cambiar de página.
 */
@Component({
  selector: 'app-admin-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <nav class="adm-pager" aria-label="Paginación">
        <span class="adm-pager__info">
          <i class="ph ph-list-numbers" aria-hidden="true"></i>
          Mostrando <strong>{{ from() }}</strong>–<strong>{{ to() }}</strong>
          de <strong>{{ total() }}</strong> {{ total() === 1 ? itemLabel() : itemLabelPlural() }}
        </span>

        <div class="adm-pager__controls">
          @if (pageSizes().length > 1 && total() > minPageSize()) {
            <label class="adm-pager__size">
              <span class="adm-sr-only">Registros por página</span>
              <select [value]="size()" (change)="changeSize($any($event.target).value)">
                @for (option of pageSizes(); track option) {
                  <option [value]="option" [selected]="option === size()">{{ option }} por página</option>
                }
              </select>
            </label>
          }

          @if (totalPages() > 1) {
            <div class="adm-pager__pages">
              <button type="button" class="adm-pager__btn" (click)="go(current() - 1)"
                      [disabled]="current() === 1" aria-label="Página anterior">
                <i class="ph ph-caret-left" aria-hidden="true"></i>
              </button>

              @for (item of items(); track item) {
                @if (item === 'gap-start' || item === 'gap-end') {
                  <span class="adm-pager__gap" aria-hidden="true">…</span>
                } @else {
                  <button type="button" class="adm-pager__btn adm-pager__num"
                          [class.adm-pager__btn--active]="item === current()"
                          [attr.aria-current]="item === current() ? 'page' : null"
                          [attr.aria-label]="'Página ' + item"
                          (click)="go(item)">{{ item }}</button>
                }
              }

              <span class="adm-pager__compact" aria-live="polite">{{ current() }} / {{ totalPages() }}</span>

              <button type="button" class="adm-pager__btn" (click)="go(current() + 1)"
                      [disabled]="current() === totalPages()" aria-label="Página siguiente">
                <i class="ph ph-caret-right" aria-hidden="true"></i>
              </button>
            </div>
          }
        </div>
      </nav>
    }
  `,
  styles: [`
    :host { display: block; }

    .adm-pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem 1rem;
      padding: 1rem 1.5rem;
      background: #FFFFFF;
      border: 1px solid #B3E5FC;
      border-top: none;
    }

    .adm-pager__info {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.3rem;
      font-size: 0.875rem;
      color: #64748B;
    }
    .adm-pager__info i { color: #2196F3; font-size: 1.05rem; }
    .adm-pager__info strong { color: #2196F3; font-weight: 700; }

    .adm-pager__controls {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .adm-pager__size select {
      height: 2.375rem;
      padding: 0 1.75rem 0 0.75rem;
      font-size: 0.875rem;
      color: #1E293B;
      background-color: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      cursor: pointer;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .adm-pager__size select:hover { border-color: #90CAF9; }
    .adm-pager__size select:focus-visible {
      outline: none;
      border-color: #2196F3;
      box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.15);
    }

    .adm-pager__pages {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .adm-pager__btn {
      min-width: 2.375rem;
      height: 2.375rem;
      padding: 0 0.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 500;
      color: #64748B;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.12s ease;
    }
    .adm-pager__btn i { font-size: 1rem; }
    .adm-pager__btn:hover:not(:disabled):not(.adm-pager__btn--active) {
      border-color: #90CAF9;
      color: #0288D1;
      background: #F0F9FF;
    }
    .adm-pager__btn:active:not(:disabled) { transform: scale(0.96); }
    .adm-pager__btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.2);
    }
    .adm-pager__btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .adm-pager__btn--active {
      background: #2196F3;
      border-color: #2196F3;
      color: #FFFFFF;
      font-weight: 600;
      cursor: default;
    }

    .adm-pager__gap { color: #94A3B8; padding: 0 0.15rem; }
    .adm-pager__compact { display: none; font-size: 0.875rem; font-weight: 600; color: #1E293B; padding: 0 0.5rem; }

    .adm-sr-only {
      position: absolute; width: 1px; height: 1px; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap;
    }

    @media (max-width: 640px) {
      .adm-pager { justify-content: center; padding: 0.9rem 1rem; }
      .adm-pager__info { justify-content: center; width: 100%; }
      .adm-pager__controls { justify-content: center; width: 100%; }
      .adm-pager__num, .adm-pager__gap { display: none; }
      .adm-pager__compact { display: inline; }
    }

    @media (prefers-reduced-motion: reduce) {
      .adm-pager__btn { transition: none; }
    }
  `],
})
export class AdminPaginationComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly total = input.required<number>();
  readonly page = model(1);
  readonly pageSize = model<number | string>(10);
  readonly pageSizes = input<number[]>([10, 20, 30, 50]);
  readonly itemLabel = input('registro');
  readonly itemLabelPlural = input('registros');

  readonly size = computed(() => Math.max(1, Number(this.pageSize()) || 10));
  readonly minPageSize = computed(() => Math.min(...this.pageSizes(), this.size()));
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly current = computed(() => Math.min(Math.max(1, Number(this.page()) || 1), this.totalPages()));
  readonly from = computed(() => (this.total() === 0 ? 0 : (this.current() - 1) * this.size() + 1));
  readonly to = computed(() => Math.min(this.current() * this.size(), this.total()));

  /** Primera, última, la actual y sus vecinas; huecos con "…". */
  readonly items = computed<PageItem[]>(() => {
    const last = this.totalPages();
    const current = this.current();
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const start = Math.max(2, Math.min(current - 1, last - 4));
    const end = Math.min(last - 1, Math.max(current + 1, 5));
    const items: PageItem[] = [1];
    if (start > 2) items.push('gap-start');
    for (let p = start; p <= end; p++) items.push(p);
    if (end < last - 1) items.push('gap-end');
    items.push(last);
    return items;
  });

  constructor() {
    // Si el total baja (filtro, eliminación), la página queda dentro del rango.
    effect(() => {
      const corrected = this.current();
      if (Number(untracked(this.page)) !== corrected) this.page.set(corrected);
    });
  }

  go(target: number) {
    const next = Math.min(Math.max(1, target), this.totalPages());
    if (next === this.current()) return;
    this.page.set(next);
    this.revealList();
  }

  changeSize(value: string) {
    const size = Number(value);
    if (!size || size === this.size()) return;
    // Conserva aproximadamente la posición: la página que contiene el primer registro visible.
    const firstIndex = (this.current() - 1) * this.size();
    this.pageSize.set(size);
    this.page.set(Math.floor(firstIndex / size) + 1);
  }

  /** Lleva el inicio del listado a la vista si quedó por encima al paginar. */
  private revealList() {
    const list = (this.host.nativeElement as HTMLElement).parentElement;
    if (!list) return;
    const top = list.getBoundingClientRect().top;
    if (top < 80) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: top - 88, behavior: reduce ? 'auto' : 'smooth' });
    }
  }
}
