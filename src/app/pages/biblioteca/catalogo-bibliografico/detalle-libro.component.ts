import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BookRecommendation,
  CatalogService,
  Libro
} from '../../../api/services/catalog.service';

@Component({
  selector: 'app-detalle-libro',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './detalle-libro.component.html',
  styleUrls: ['./catalog.component.css', './detalle-libro.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DetalleLibroComponent implements OnInit {
  libro: Libro | null = null;
  cargando = true;
  noEncontrado = false;
  recomendaciones: BookRecommendation[] = [];
  cargandoRecomendaciones = false;
  errorRecomendaciones = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private catalogService: CatalogService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.marcarNoEncontrado();
      return;
    }

    const libroNavegado = history.state?.libro as Libro | undefined;
    if (libroNavegado?.id === id) {
      this.libro = libroNavegado;
      this.cargando = false;
      this.cargarPreviewSiHaceFalta();
      this.cargarRecomendaciones(id);
      return;
    }

    this.catalogService.obtenerCatalogo().subscribe({
      next: (libros) => {
        this.libro = libros.find((libro) => Number(libro.id) === id) || null;
        this.cargando = false;
        this.noEncontrado = !this.libro;
        this.cargarPreviewSiHaceFalta();
        if (this.libro) this.cargarRecomendaciones(id);
      },
      error: () => this.marcarNoEncontrado()
    });
  }

  verLibro(): void {
    if (this.libro?.id && this.libro.tiene_digital) {
      this.router.navigate(['/biblioteca/libro', this.libro.id]);
    }
  }

  abrirRecomendacion(libro: BookRecommendation): void {
    if (libro.tiene_digital) {
      this.router.navigate(['/biblioteca/libro', libro.id]);
      return;
    }

    this.router.navigate(['/catalogo'], {
      queryParams: { search: libro.titulo }
    });
  }

  private cargarRecomendaciones(libroId: number): void {
    this.cargandoRecomendaciones = true;
    this.errorRecomendaciones = false;

    this.catalogService.obtenerRecomendaciones(libroId, 5).subscribe({
      next: ({ recomendaciones }) => {
        this.recomendaciones = recomendaciones;
        this.cargandoRecomendaciones = false;
      },
      error: () => {
        this.recomendaciones = [];
        this.cargandoRecomendaciones = false;
        this.errorRecomendaciones = true;
      }
    });
  }

  private cargarPreviewSiHaceFalta(): void {
    if (!this.libro?.id || !this.libro.tiene_digital || this.libro.previewUrl) return;

    this.catalogService.obtenerPreview(this.libro.id).subscribe({
      next: ({ previewUrl }) => {
        if (this.libro) this.libro.previewUrl = previewUrl;
      },
      error: () => {}
    });
  }

  private marcarNoEncontrado(): void {
    this.libro = null;
    this.cargando = false;
    this.noEncontrado = true;
  }
}
