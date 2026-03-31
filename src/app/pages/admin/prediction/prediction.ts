import {
  Component, OnInit, AfterViewInit,
  ViewChild, ElementRef, ViewEncapsulation, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { PredictionService } from '../../../api/services/prediction.service';

Chart.register(...registerables);

const PALETTE = [
  '#1565C0','#2E7D32','#6A1B9A','#E65100',
  '#F57F17','#B71C1C','#0277BD','#00695C',
  '#558B2F','#4527A0',
];

const predZonePlugin = {
  id: 'predZone',
  beforeDraw(chart: any) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.x) return;
    const ds = chart.data.datasets[1];
    if (!ds?.data) return;
    let fi = -1;
    for (let i = 0; i < ds.data.length; i++) {
      if (ds.data[i] !== null) { fi = i; break; }
    }
    if (fi < 0) return;
    const xStart = scales.x.getPixelForValue(fi);
    const xEnd   = chartArea.right;
    ctx.save();
    ctx.fillStyle = 'rgba(3,169,244,0.05)';
    ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
    ctx.strokeStyle = 'rgba(3,169,244,0.35)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(xStart, chartArea.top);
    ctx.lineTo(xStart, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(3,169,244,0.75)';
    ctx.font      = '500 11px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Estimacion ->', xStart + 6, chartArea.top + 14);
    ctx.restore();
  },
};
Chart.register(predZonePlugin);

@Component({
  selector: 'app-prediction',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prediction.html',
  styleUrls: ['./prediction.css'],
  encapsulation: ViewEncapsulation.None,
})
export class PredictionComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('chartCanvas')   chartCanvas!:   ElementRef<HTMLCanvasElement>;
  @ViewChild('subjectCanvas') subjectCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('heatmapCanvas') heatmapCanvas!: ElementRef<HTMLCanvasElement>;

  readonly Math = Math;

  /* ── FIG 2 ───────────────────────────────────── */
  prestamos:     any[] = [];
  filtroPrestamo = '';
  paginaActual   = 1;
  itemsPorPagina = 10;

  /* ── FIG 3 ───────────────────────────────────── */
  agrupados:     any[] = [];
  filtroAgrupado = '';

  /* ── General ─────────────────────────────────── */
  cargando = false;

  /* ── FIG 4 ───────────────────────────────────── */
  modelo:      any   = null;
  historical:  any[] = [];
  predictions: any[] = [];
  chartData:   any[] = [];

  /* ── FIG 6 ───────────────────────────────────── */
  resumen: any = null;

  /* ── FIG 7 ───────────────────────────────────── */
  materias:            any[]  = [];
  materiaSeleccionada         = '';
  detalleMateria:      any    = null;
  cargandoMateria             = false;

  /* ── FIG 5 ───────────────────────────────────── */
  periodoLabels:         string[] = [];
  periodoLabelsExtended: string[] = [];
  crucePorMateria:       any[]    = [];

  private mainChart:    Chart | null = null;
  private subjectChart: Chart | null = null;
  private heatChart:    Chart | null = null;

  constructor(private svc: PredictionService) {}

  ngOnInit(): void     { this.cargarDatos(); }
  ngAfterViewInit(): void {}
  ngOnDestroy(): void  { this.destroyCharts(); }

  /* ══════════════════════════════════════════════
     CARGA PRINCIPAL
  ══════════════════════════════════════════════ */
  async cargarDatos(): Promise<void> {
    this.cargando = true;
    this.destroyCharts();

    try {
      const [modeloRes, totalRes, materiasRes, historicoRes, prestamosRes, agrupadosRes] =
        await Promise.all([
          firstValueFrom(this.svc.getModelo()),
          firstValueFrom(this.svc.getPrediccionTotal()),
          firstValueFrom(this.svc.getMaterias()),
          firstValueFrom(this.svc.getHistorico()),
          firstValueFrom(this.svc.getPrestamos()),
          firstValueFrom(this.svc.getAgrupados()),
        ]);

      /* FIG 2 */
      this.prestamos = prestamosRes.prestamos ?? [];

      /* FIG 3 */
      this.agrupados = agrupadosRes.periodos ?? [];

      /* FIG 4 */
      this.modelo      = modeloRes.modelo;
      this.historical  = modeloRes.historical;
      this.predictions = modeloRes.predictions;
      this.chartData   = modeloRes.chart;

      /* FIG 6 */
      this.resumen = totalRes.resumen;
      if (!this.predictions?.length) this.predictions = totalRes.predictions;

      /* FIG 7 */
      this.materias = materiasRes.materias ?? [];

      /* FIG 5 */
      this.periodoLabels = (historicoRes.historical ?? []).map(
        (h: any) => `${h.intervalo} ${h.year}`
      );
      const predLabels = (modeloRes.predictions ?? []).map((p: any) => p.label);
      this.periodoLabelsExtended = [...this.periodoLabels, ...predLabels];
      this.crucePorMateria = historicoRes.crucePorMateria ?? [];

      setTimeout(() => {
        this.renderMainChart();
        this.renderSubjectChart();
        this.renderHeatmap();
      }, 60);

    } catch (err) {
      console.error('[Prediction] cargarDatos:', err);
      Swal.fire({ icon: 'error', title: 'Error al cargar', text: 'No se pudieron obtener los datos de la estimacion de prestamos.' });
    } finally {
      this.cargando = false;
    }
  }

  /* ── Paginación ──────────────────────────────── */
  get prestamosFiltered(): any[] {
    const q = this.filtroPrestamo.toLowerCase().trim();
    return q
      ? this.prestamos.filter(p =>
          p.alumno?.toLowerCase().includes(q)    ||
          p.matricula?.toLowerCase().includes(q) ||
          p.libro?.toLowerCase().includes(q)     ||
          p.materias?.toLowerCase().includes(q)
        )
      : this.prestamos;
  }

  get totalPaginas(): number {
    return Math.ceil(this.prestamosFiltered.length / this.itemsPorPagina) || 1;
  }

  get prestamosPage(): any[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.prestamosFiltered.slice(inicio, inicio + this.itemsPorPagina);
  }

  get paginasVisibles(): number[] {
    const total  = this.totalPaginas;
    const actual = this.paginaActual;
    const inicio = Math.max(1, actual - 2);
    const fin    = Math.min(total, actual + 2);
    const pags: number[] = [];
    for (let i = inicio; i <= fin; i++) pags.push(i);
    return pags;
  }

  irPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.paginaActual = p;
  }

  onFiltroPrestamo(valor: string): void {
    this.filtroPrestamo = valor;
    this.paginaActual   = 1;
  }

  /* ── Filtro agrupados ────────────────────────── */
  get agrupadosFiltered(): any[] {
    const q = this.filtroAgrupado.toLowerCase().trim();
    if (!q) return this.agrupados;
    return this.agrupados.filter(a =>
      a.label?.toLowerCase().includes(q) ||
      a.materias?.some((m: any) => m.materia.toLowerCase().includes(q))
    );
  }

  /* ── Detalle por materia ─────────────────────── */
  async cargarMateria(): Promise<void> {
    if (!this.materiaSeleccionada) return;
    this.cargandoMateria = true;
    this.detalleMateria  = null;
    try {
      this.detalleMateria = await firstValueFrom(
        this.svc.getPorMateria(this.materiaSeleccionada)
      );
    } catch (err) {
      console.error('[Prediction] cargarMateria:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la materia seleccionada.' });
    } finally {
      this.cargandoMateria = false;
    }
  }

  /* ── Helpers generales ───────────────────────── */
  getIncrement(i: number): number {
    if (i === 0) return 0;
    return this.historical[i].total - this.historical[i - 1].total;
  }

  getVariacion(val: number): number {
    if (!this.historical.length) return 0;
    return val - this.historical[this.historical.length - 1].total;
  }

  getVariacionPct(val: number): string {
    if (!this.historical.length) return '0.00';
    const last = this.historical[this.historical.length - 1].total;
    if (!last) return '0.00';
    return (((val - last) / last) * 100).toFixed(2);
  }

  getBarColor(i: number): string {
    return PALETTE[i % PALETTE.length];
  }

  /* ── Helpers cruce materia × periodo ─────────── */
  private getPctMateria(m: any): number {
    const totalGlobal = this.crucePorMateria.reduce((sum, mat) =>
      sum + mat.detalle.reduce((s: number, d: any) => s + d.total, 0), 0
    );
    const totalMateria = m.detalle.reduce((s: number, d: any) => s + d.total, 0);
    return totalGlobal > 0 ? totalMateria / totalGlobal : 0;
  }

  getPredMateria(m: any, periodoIdx: number): number {
    const p = this.predictions[periodoIdx];
    if (!p) return 0;
    return Math.round(this.getPctMateria(m) * (p.valor ?? p.valor_estimado ?? 0));
  }

  getTotalMateriaExtended(m: any, predictions: any[]): number {
    const historico  = m.detalle.reduce((s: number, d: any) => s + d.total, 0);
    const prediccion = predictions.reduce((s: number, _: any, i: number) =>
      s + this.getPredMateria(m, i), 0
    );
    return historico + prediccion;
  }

  getTotalPeriodo(label: string): number {
    return this.crucePorMateria.reduce((sum, m) => {
      const d = m.detalle.find((d: any) => d.periodo === label);
      return sum + (d?.total ?? 0);
    }, 0);
  }

  getTotalGeneral(): number {
    const historico  = this.crucePorMateria.reduce((sum, m) =>
      sum + m.detalle.reduce((s: number, d: any) => s + d.total, 0), 0
    );
    const prediccion = (this.predictions ?? []).reduce((s: number, p: any) =>
      s + (p.valor ?? p.valor_estimado ?? 0), 0
    );
    return historico + prediccion;
  }

  getTotalMateria(detalle: any[]): number {
    return detalle?.reduce((s: number, d: any) => s + (d.total ?? 0), 0) ?? 0;
  }

  /* ══════════════════════════════════════════════
     GRÁFICA PRINCIPAL — modelo exponencial
  ══════════════════════════════════════════════ */
  private renderMainChart(): void {
    if (!this.chartCanvas) return;
    const labels      = this.chartData.map(d => d.label);
    const reales      = this.chartData.map(d => d.tipo === 'real'       ? d.valor : null);
    const preds       = this.chartData.map(d => d.tipo === 'prediccion' ? d.valor : null);
    const lastRealIdx = this.chartData.reduce((a, d, i) => d.tipo === 'real' ? i : a, -1);
    if (lastRealIdx >= 0 && lastRealIdx + 1 < this.chartData.length) {
      preds[lastRealIdx] = this.chartData[lastRealIdx].valor;
    }
    this.mainChart = new Chart(this.chartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Datos reales',
            data: reales,
            borderColor: '#1565C0',
            backgroundColor: 'rgba(21,101,192,0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#1565C0',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 9,
            tension: 0.35,
            fill: true,
            spanGaps: false,
          },
          {
            label: 'Estimacion',
            data: preds,
            borderColor: '#03A9F4',
            backgroundColor: 'rgba(3,169,244,0)',
            borderWidth: 2.5,
            borderDash: [8, 4],
            pointBackgroundColor: '#03A9F4',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 7,
            pointHoverRadius: 10,
            pointStyle: 'rectRot',
            tension: 0.35,
            fill: false,
            spanGaps: false,
          } as any,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1E293B', titleColor: '#90CAF9', bodyColor: '#E3F2FD',
            padding: 12, cornerRadius: 6,
            borderColor: 'rgba(144,202,249,0.2)', borderWidth: 1,
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                return v !== null ? ` ${ctx.dataset.label}: ${v} préstamos` : '';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(187,222,251,0.45)' },
            border: { color: '#BBDEFB' },
            ticks: { autoSkip: false, maxRotation: 40, color: '#64748B', font: { size: 10, family: 'JetBrains Mono' } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(187,222,251,0.45)' },
            border: { color: '#BBDEFB' },
            ticks: { color: '#64748B', font: { size: 11, family: 'JetBrains Mono' } },
          },
        },
      },
    });
  }

  /* ══════════════════════════════════════════════
     GRÁFICA DISTRIBUCIÓN — histórico vs predicción
     Barras apiladas horizontales con separación visual
     clara entre zona real y zona estimada.
  ══════════════════════════════════════════════ */
private renderSubjectChart(): void {
  if (!this.subjectCanvas || !this.crucePorMateria.length) return;

  const totalesHistorico = this.crucePorMateria.map(m => ({
    materia: m.materia,
    total:   m.detalle.reduce((s: number, d: any) => s + d.total, 0),
  }));
  const totalGlobal = totalesHistorico.reduce((s, m) => s + m.total, 0);
  const totalPredGlobal = (this.predictions ?? [])
    .reduce((s: number, p: any) => s + (p.valor ?? p.valor_estimado ?? 0), 0);

  const datos = totalesHistorico
    .map(m => ({
      materia:    m.materia,
      historico:  m.total,
      prediccion: totalGlobal > 0
        ? Math.round((m.total / totalGlobal) * totalPredGlobal) : 0,
    }))
    .sort((a, b) => (b.historico + b.prediccion) - (a.historico + a.prediccion));

  const labels = datos.map(d => d.materia);

  this.subjectChart = new Chart(this.subjectCanvas.nativeElement, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Historico real',
          data:  datos.map(d => d.historico),
          backgroundColor: 'rgba(21,101,192,0.25)',  // ← color único azul
          borderColor:     '#1565C0',                // ← color único azul
          borderWidth: 2,
          borderRadius: 3,
          borderSkipped: false,
        },
        {
          label: 'Estimacion (3 periodos)',
          data:  datos.map(d => d.prediccion),
          backgroundColor: 'rgba(142, 113, 236, 0.4)',    // ← color único ámbar
          borderColor:     '#6f38e6',                // ← color único ámbar
          borderWidth: 2,
          borderRadius: 3,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1E293B', titleColor: '#90CAF9', bodyColor: '#E3F2FD',
          padding: 12, cornerRadius: 6,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.x} préstamos`,
            afterBody: (items) => {
              const idx     = items[0]?.dataIndex ?? 0;
              const hist    = datos[idx]?.historico  ?? 0;
              const pred    = datos[idx]?.prediccion ?? 0;
              const total   = hist + pred;
              const pctPred = total > 0 ? ((pred / total) * 100).toFixed(1) : '0';
              return [`-----------------`, `Total estimado: ${total}`, `Representa: ${pctPred}%`];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          stacked: false,
          grid: { color: 'rgba(187,222,251,0.45)' },
          border: { color: '#BBDEFB' },
          ticks: { color: '#64748B', font: { size: 11, family: 'JetBrains Mono' } },
        },
        y: {
          stacked: false,
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#64748B', font: { size: 11 } },
        },
      },
    },
  });
}

  /* ══════════════════════════════════════════════
     HEATMAP — cruce materia × periodo (FIG 5)
  ══════════════════════════════════════════════ */
  private renderHeatmap(): void {
    if (!this.heatmapCanvas || !this.crucePorMateria.length) return;

    const totalGlobal = this.crucePorMateria.reduce((sum, m) =>
      sum + m.detalle.reduce((s: number, d: any) => s + d.total, 0), 0
    );
    const predsGlobal = (this.predictions ?? []).map(
      (p: any) => p.valor ?? p.valor_estimado ?? 0
    );

    const datasets = this.crucePorMateria.map((m, mi) => {
      const totalMateria  = m.detalle.reduce((s: number, d: any) => s + d.total, 0);
      const pct           = totalGlobal > 0 ? totalMateria / totalGlobal : 0;
      const dataHistorico = m.detalle.map((d: any) => d.total);
      const dataPrediccion = predsGlobal.map(total => Math.round(pct * total));
      return {
        label:           m.materia,
        data:            [...dataHistorico, ...dataPrediccion],
        backgroundColor: PALETTE[mi % PALETTE.length] + '44',
        borderColor:     PALETTE[mi % PALETTE.length],
        borderWidth:     1.5,
        pointRadius:     (ctx: any) =>
          ctx.dataIndex >= dataHistorico.length ? 6 : 4,
        pointStyle: (ctx: any) =>
          ctx.dataIndex >= dataHistorico.length ? 'rectRot' : 'circle',
        borderDash: [] as number[],
        segment: {
          borderDash: (ctx: any) =>
            ctx.p0DataIndex >= dataHistorico.length - 1 ? [6, 3] : [],
        },
        tension: 0.3,
      };
    });

    this.heatChart = new Chart(this.heatmapCanvas.nativeElement, {
      type: 'line',
      data: { labels: this.periodoLabelsExtended, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: '#64748B', font: { size: 10 }, boxWidth: 12, padding: 10 },
          },
          tooltip: {
            backgroundColor: '#1E293B', titleColor: '#90CAF9', bodyColor: '#E3F2FD',
            padding: 10, cornerRadius: 6,
            callbacks: {
              title: (items) => {
                const idx    = items[0]?.dataIndex ?? 0;
                const label  = this.periodoLabelsExtended[idx] ?? '';
                const esPred = idx >= this.periodoLabels.length;
                return esPred ? `${label}  ★ estimacion` : label;
              },
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} préstamos`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(187,222,251,0.45)' },
            border: { color: '#BBDEFB' },
            ticks: {
              color: (ctx) =>
                ctx.index >= this.periodoLabels.length ? '#03A9F4' : '#64748B',
              font: { size: 10, family: 'JetBrains Mono' },
              maxRotation: 35,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(187,222,251,0.45)' },
            border: { color: '#BBDEFB' },
            ticks: { color: '#64748B', font: { size: 11, family: 'JetBrains Mono' } },
          },
        },
      },
    });
  }

  private destroyCharts(): void {
    this.mainChart?.destroy();    this.mainChart    = null;
    this.subjectChart?.destroy(); this.subjectChart = null;
    this.heatChart?.destroy();    this.heatChart    = null;
  }
}
