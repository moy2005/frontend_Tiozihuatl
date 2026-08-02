import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminClusterBook, AdminClustersResponse, CatalogService, ClusterProfileSummary } from '../../../api/services/catalog.service';

@Component({ selector: 'app-clustering-libros', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './clustering-libros.html', styleUrls: ['./clustering-libros.css'] })
export class ClusteringLibrosComponent implements OnInit {
  data?: AdminClustersResponse; loading = true; error = ''; selectedCluster: number | 'all' = 'all'; search = '';
  constructor(private catalogService: CatalogService) {}
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading = true; this.error = '';
    this.catalogService.obtenerAnalisisClusters().subscribe({
      next: (response) => { this.data = response; this.loading = false; },
      error: (error) => { this.error = error?.error?.message || 'No fue posible cargar la segmentación del catálogo.'; this.loading = false; },
    });
  }
  get books(): AdminClusterBook[] {
    const query = this.search.trim().toLocaleLowerCase('es');
    return (this.data?.books || []).filter((book) =>
      (this.selectedCluster === 'all' || book.cluster === this.selectedCluster) &&
      (!query || book.titulo.toLocaleLowerCase('es').includes(query))
    );
  }
  selectProfile(profile?: ClusterProfileSummary): void { this.selectedCluster = profile?.cluster ?? 'all'; }
  trendLabel(value: number): string {
    if (value >= 0.05) return 'Interés digital en crecimiento';
    if (value <= -0.05) return 'Actividad digital en descenso';
    return 'Actividad digital estable';
  }
  trendClass(value: number): string {
    if (value >= 0.05) return 'trend-up';
    if (value <= -0.05) return 'trend-down';
    return 'trend-stable';
  }
}
