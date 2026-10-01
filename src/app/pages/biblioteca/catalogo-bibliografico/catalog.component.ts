import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { CatalogService, Libro } from '../../../api/services/catalog.service';
import { Router } from '@angular/router';
import { VoiceSearchComponent } from '../../../pwa/voice-search.component';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, VoiceSearchComponent],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CatalogoComponent implements OnInit, OnDestroy {

  libros:       Libro[] = [];
  search        = '';
  filtroMateria = '';
  filtroFormato = '';
  ordenAutor    = '';
  materias:     { nombre: string }[] = [];
  pdfSeleccionado: string | null = null;
  cargando        = false; 
  cargandoInicial = true;  

  paginaActual    = 1;
  librosPorPagina = 15;

  filtroSemestre = '';
  semestres: any[] = [];

  private searchSubject = new Subject<string>();
  private destroy$      = new Subject<void>();
  private catalogRequest?: Subscription;
  private requestVersion = 0;
  errorCarga = false;

  constructor(
    private catalogService: CatalogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarMaterias();
    this._ejecutarCarga();
    this.cargarSemestres();

    this.searchSubject.pipe(
      debounceTime(400),
      takeUntil(this.destroy$)
    ).subscribe((valor) => {
      this.search = valor;
      this._ejecutarCarga();
    });
  }

  ngOnDestroy(): void {
    this.catalogRequest?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: Event): void {
    this.actualizarBusqueda((event.target as HTMLInputElement).value);
  }

  actualizarBusqueda(valor: string): void {
    this.search = valor.slice(0, 200);
    this.paginaActual = 1;
    this.catalogRequest?.unsubscribe();
    this.searchSubject.next(this.search);
  }

  limpiarBusqueda(): void {
    this.actualizarBusqueda('');
  }

  cargarCatalogo(): void {
    this._ejecutarCarga();
  }

  cargarSemestres(): void {
    this.catalogService.obtenerSemestres().subscribe({
      next: (res) => this.semestres = res,
      error: (err) => console.error(err)
    });
  }

  borrarFiltros(): void {
    this.filtroMateria = '';
    this.filtroFormato = '';
    this.ordenAutor    = '';
    this.filtroSemestre = '';
    this._ejecutarCarga();
  }

  get hayFiltrosActivos(): boolean {
    return this.filtroMateria !== '' || 
       this.filtroFormato !== '' || 
       this.ordenAutor !== '' ||
       this.filtroSemestre !== '';
  }

  private _ejecutarCarga(): void {
    this.catalogRequest?.unsubscribe();
    const version = ++this.requestVersion;
    this.errorCarga = false;
    if (this.cargandoInicial) {
      this.cargando = true;
    }
    this.paginaActual = 1;

    this.catalogRequest = this.catalogService.obtenerCatalogo(
      this.search,
      this.filtroMateria,
      this.filtroFormato,
      this.ordenAutor,
      this.filtroSemestre
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (version !== this.requestVersion) return;
        this.libros          = res;
        this.cargando        = false;
        this.cargandoInicial = false; 
        this._cargarPreviewsPagina();
      },
      error: (err) => {
        if (version !== this.requestVersion) return;
        this.libros = [];
        this.errorCarga = true;
        console.error(err);
        this.cargando        = false;
        this.cargandoInicial = false;
      }
    });
  }

  private _cargarPreviewsPagina(): void {
    this.librosPaginados
      .filter(l => l.tiene_digital && l.id && !l.previewUrl)
      .forEach(libro => {
        this.catalogService.obtenerPreview(libro.id!).pipe(takeUntil(this.destroy$)).subscribe({
          next: (p) => { libro.previewUrl = p.previewUrl; },
          error: () => {}
        });
      });
  }

  cargarMaterias(): void {
    this.catalogService.obtenerMaterias().subscribe({
      next:  (res) => { this.materias = res; },
      error: (err) => console.error(err)
    });
  }

  abrirPdf(libro: Libro): void {
    if (!libro.id) return;
    this.router.navigate(['/biblioteca/libro', libro.id]);
  }
  cerrarPdf(): void { this.pdfSeleccionado = null; }

  abrirDetalle(libro: Libro): void {
    if (!libro.id) return;
    this.router.navigate(['/biblioteca/detalle', libro.id], {
      state: { libro }
    });
  }

  get librosFiltrados(): Libro[] { return this.libros; }

  get librosPaginados(): Libro[] {
    const inicio = (this.paginaActual - 1) * this.librosPorPagina;
    return this.librosFiltrados.slice(inicio, inicio + this.librosPorPagina);
  }

  get totalPaginas(): number {
    return Math.ceil(this.librosFiltrados.length / this.librosPorPagina);
  }

  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this._cargarPreviewsPagina();
  }

}
