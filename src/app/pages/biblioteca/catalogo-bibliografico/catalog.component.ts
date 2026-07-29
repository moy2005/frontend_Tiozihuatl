import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import {
  BookRecommendation,
  CatalogService,
  ClusterBook,
  Libro,
  ReadingProfileShelf
} from '../../../api/services/catalog.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  libroSeleccionado: Libro | null = null;
  modalDetalle = false;
  recomendaciones: BookRecommendation[] = [];
  cargandoRecomendaciones = false;
  errorRecomendaciones = false;

  paginaActual    = 1;
  librosPorPagina = 15;

  filtroSemestre = '';
  semestres: any[] = [];
  perfilesLectura: ReadingProfileShelf[] = [];
  perfilActivo = 0;
  cargandoPerfiles = true;

  private searchSubject = new Subject<string>();
  private destroy$      = new Subject<void>();
  private solicitudRecomendacionesId = 0;

  constructor(
    private catalogService: CatalogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarMaterias();
    this._ejecutarCarga();
    this.cargarSemestres();
    this.cargarPerfilesLectura();

    this.searchSubject.pipe(
      debounceTime(400),
      takeUntil(this.destroy$)
    ).subscribe((valor) => {
      this.search = valor;
      this._ejecutarCarga();
    });
  }

  cargarPerfilesLectura(): void {
    this.catalogService.obtenerPerfilesLectura(24).subscribe({
      next: (res) => {
        this.perfilesLectura = res.shelves;
        this.perfilActivo = res.shelves[0]?.cluster ?? 0;
        this.cargandoPerfiles = false;
      },
      error: () => { this.cargandoPerfiles = false; }
    });
  }

  get perfilSeleccionado(): ReadingProfileShelf | undefined {
    return this.perfilesLectura.find((perfil) => perfil.cluster === this.perfilActivo);
  }

  abrirLibroCluster(libro: ClusterBook): void {
    if (libro.tiene_digital) this.router.navigate(['/biblioteca/libro', libro.id]);
  }

  desplazarLibros(contenedor: HTMLElement, direccion: number): void {
    contenedor.scrollBy({ left: direccion * Math.min(contenedor.clientWidth * 0.8, 760), behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.paginaActual = 1;
    this.searchSubject.next(valor);
  }

  limpiarBusqueda(): void {
    this.search = '';
    this._ejecutarCarga();
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
    if (this.cargandoInicial) {
      this.cargando = true;
    }
    this.paginaActual = 1;

    this.catalogService.obtenerCatalogo(
      this.search,
      this.filtroMateria,
      this.filtroFormato,
      this.ordenAutor,
      this.filtroSemestre
    ).subscribe({
      next: (res) => {
        this.libros          = res;
        this.cargando        = false;
        this.cargandoInicial = false; 
        this._cargarPreviewsPagina();
      },
      error: (err) => {
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
        this.catalogService.obtenerPreview(libro.id!).subscribe({
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
    this.libroSeleccionado = libro;
    this.modalDetalle = true;
    this.recomendaciones = [];
    this.errorRecomendaciones = false;
    this.cargarRecomendaciones(libro.id);
  }

  cerrarDetalle(): void {
    this.solicitudRecomendacionesId++;
    this.modalDetalle = false;
    this.libroSeleccionado = null;
    this.recomendaciones = [];
    this.cargandoRecomendaciones = false;
    this.errorRecomendaciones = false;
  }

  cargarRecomendaciones(libroId: number): void {
    const solicitudId = ++this.solicitudRecomendacionesId;
    this.cargandoRecomendaciones = true;

    this.catalogService.obtenerRecomendaciones(libroId, 5).subscribe({
      next: (response) => {
        if (
          solicitudId !== this.solicitudRecomendacionesId ||
          this.libroSeleccionado?.id !== libroId
        ) return;

        this.recomendaciones = response.recomendaciones;
        this.cargandoRecomendaciones = false;
      },
      error: (error) => {
        if (solicitudId !== this.solicitudRecomendacionesId) return;

        console.error('Error al cargar recomendaciones:', error);
        this.recomendaciones = [];
        this.cargandoRecomendaciones = false;
        this.errorRecomendaciones = true;
      }
    });
  }

  abrirRecomendacion(libro: BookRecommendation): void {
    if (libro.tiene_digital) {
      this.cerrarDetalle();
      this.router.navigate(['/biblioteca/libro', libro.id]);
      return;
    }

    this.cerrarDetalle();
    this.search = libro.titulo;
    this.filtroMateria = '';
    this.filtroFormato = '';
    this.ordenAutor = '';
    this.filtroSemestre = '';
    this._ejecutarCarga();
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
