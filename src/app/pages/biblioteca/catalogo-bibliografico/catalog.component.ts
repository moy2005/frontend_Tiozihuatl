import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogService, Libro } from '../../../api/services/catalog.service.js';
import { SafeUrlPipe } from '../../../pipes/safe-url.pipe';
import { environment } from '../../../api/environments/environment.prod.js';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule,SafeUrlPipe],
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CatalogoComponent implements OnInit {

  libros: Libro[] = [];

  // 🔎 búsqueda
  search: string = '';

  // 🔽 filtros
  filtroMateria: string = '';
  filtroFormato: string = '';
  ordenAutor: string = '';

  materias: { nombre: string }[] = [];

  pdfSeleccionado: string | null = null;

  constructor(private catalogService: CatalogService) {}

  ngOnInit(): void {
    this.cargarMaterias();
    this.cargarCatalogo();
  }

  cargarCatalogo(): void {
  this.catalogService.obtenerCatalogo(
    this.search,
    this.filtroMateria,
    this.filtroFormato,
    this.ordenAutor
  ).subscribe({
    next: (res) => {
      this.libros = res;

      // 🔹 GENERAR PREVIEW PARA LIBROS DIGITALES
      this.libros.forEach(libro => {
        if (libro.tiene_digital && libro.id) {
          this.catalogService.obtenerPreview(libro.id)
            .subscribe({
              next: (preview) => {
                libro.previewUrl = preview.previewUrl;
              },
              error: (err) => {
                console.error('Error preview:', err);
              }
            });
        }
      });
    },
    error: (err) => {
      console.error('Error al cargar catálogo:', err);
    }
  });
}

  cargarMaterias(): void {
    this.catalogService.obtenerMaterias().subscribe({
      next: (res) => {
        this.materias = res;
      },
      error: (err) => {
        console.error('Error al cargar materias:', err);
      }
    });
  }
  
  abrirPdf(libro: Libro) {
  if (!libro.id) return;

 // this.pdfSeleccionado = `http://localhost:4000/api/catalog/libros/${libro.id}/pdf`;
  this.pdfSeleccionado =  `${environment.apiUrl}/catalog/libros/${libro.id}/pdf`;
}
  
  cerrarPdf() {
    this.pdfSeleccionado = null;
  }
}