import { Component, DestroyRef, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, from, mergeMap, switchMap, tap } from 'rxjs';
import { FiltroPrestamos, Prestamo, PrestamoService } from '../../api/services/prestamo.service';
import { CatalogService } from '../../api/services/catalog.service';
import { PageHero } from '../../components/page-hero/page-hero';

@Component({
  selector: 'app-my-loans',
  standalone: true,
  imports: [CommonModule, PageHero],
  templateUrl: './my-loans.html',
  styleUrls: ['../biblioteca/library-pagination.css', './my-loans.css'],
  encapsulation: ViewEncapsulation.None,
})
export class MyLoans implements OnInit {
  readonly filtros: ReadonlyArray<{ id: FiltroPrestamos; label: string }> = [
    { id: 'activos', label: 'Activos' },
    { id: 'vencidos', label: 'Vencidos' },
    { id: 'historial', label: 'Historial' },
  ];
  prestamos: Prestamo[] = [];
  filtroActual: FiltroPrestamos = 'activos';
  paginaActual = 1;
  totalPaginas = 0;
  cargando = false;
  mensajeError = '';
  private paginaSolicitada = 1;
  private readonly limite = 9;
  private readonly destroyRef = inject(DestroyRef);
  private readonly solicitudes = new Subject<{ filtro: FiltroPrestamos; pagina: number }>();
  private readonly portadas = new Map<number, string>();
  private readonly presta = inject(PrestamoService);
  private readonly catalogo = inject(CatalogService);

  ngOnInit(): void {
    this.solicitudes.pipe(
      switchMap(({ filtro, pagina }) => this.presta.obtenerMisPrestamos(filtro, pagina, this.limite).pipe(
        switchMap(response => {
          if (!response.success || !response.data || !response.paginacion) {
            this.mensajeError = response.message || 'No se pudieron cargar los préstamos.';
            this.cargando = false;
            return EMPTY;
          }
          this.paginaActual = response.paginacion.pagina;
          this.totalPaginas = response.paginacion.totalPaginas;
          this.prestamos = response.data.map(prestamo => ({
            ...prestamo,
            previewUrl: this.portadas.get(prestamo.libro_id),
          }));
          this.cargando = false;
          const libros = new Set(this.prestamos
            .filter(prestamo => prestamo.tiene_digital && !prestamo.previewUrl)
            .map(prestamo => prestamo.libro_id));
          return from(libros).pipe(
            mergeMap(id => this.catalogo.obtenerPreview(id).pipe(
              tap(preview => {
                if (!preview.previewUrl) return;
                this.portadas.set(id, preview.previewUrl);
                this.prestamos = this.prestamos.map(prestamo => prestamo.libro_id === id
                  ? { ...prestamo, previewUrl: preview.previewUrl }
                  : prestamo);
              }),
              catchError(() => EMPTY),
            ), 3),
          );
        }),
        catchError(() => {
          this.mensajeError = 'No se pudieron cargar los préstamos.';
          this.cargando = false;
          return EMPTY;
        }),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
    this.cargarMisPrestamos();
  }

  cargarMisPrestamos(): void {
    this.cargando = true;
    this.mensajeError = '';
    this.solicitudes.next({ filtro: this.filtroActual, pagina: this.paginaSolicitada });
  }

  cambiarFiltro(filtro: FiltroPrestamos): void {
    if (filtro === this.filtroActual) return;
    this.filtroActual = filtro;
    this.paginaActual = this.paginaSolicitada = 1;
    this.totalPaginas = 0;
    this.prestamos = [];
    this.cargarMisPrestamos();
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas || pagina === this.paginaActual) return;
    this.paginaSolicitada = pagina;
    this.cargarMisPrestamos();
  }

  get paginas(): number[] {
    const inicio = Math.max(1, Math.min(this.paginaActual - 2, this.totalPaginas - 4));
    return Array.from({ length: Math.min(this.totalPaginas, 5) }, (_, index) => inicio + index);
  }

  trackPrestamo(_: number, prestamo: Prestamo): number {
    return prestamo.id_prestamo;
  }

  formatearFecha(fecha: string | null): string {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: '2-digit',
    }).replace('.', '');
  }
}
