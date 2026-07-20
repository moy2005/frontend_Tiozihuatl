export type ReportType = 'general' | 'usuarios' | 'libros' | 'prestamos' | 'ventas' | 'eventos';
export type ReportStatus = '' | 'activo' | 'completado' | 'pendiente' | 'cancelado';

export interface ReportFilters {
  fecha_inicio: string;
  fecha_fin: string;
  tipo_reporte: ReportType;
  estado: ReportStatus;
}

export interface ReportKpi {
  value: number;
  period?: number;
  previous?: number;
  variation?: number;
  total?: number;
  revenue?: number;
}

export interface ReportSnapshot {
  meta: {
    generated_at: string;
    filters: ReportFilters;
    previous_period: Partial<ReportFilters>;
    granularity: 'day' | 'week' | 'month';
  };
  kpis: {
    users: ReportKpi;
    books: ReportKpi;
    loans: ReportKpi;
    sales: ReportKpi;
    events: ReportKpi;
  };
  charts: {
    loan_trend: LoanTrendPoint[];
    top_books: TopBookRow[];
    users_by_role: UsersByRolePoint[];
    magazine_sales: MagazineSalesPoint[];
    institutional_activity: InstitutionalActivityPoint[];
  };
  tables: {
    latest_loans: LatestLoanRow[];
    top_books: TopBookRow[];
    latest_sales: LatestSaleRow[];
    recent_activity: RecentActivityRow[];
  };
}

export interface LoanTrendPoint {
  fecha: string;
  prestamos: number;
  devoluciones: number;
}

export interface TopBookRow {
  id: number;
  titulo: string;
  solicitudes: number;
  devoluciones: number;
  disponibles: number;
  ultima_solicitud: string | null;
}

export interface UsersByRolePoint {
  rol: string;
  total: number;
}

export interface MagazineSalesPoint {
  id_revista: number;
  titulo: string;
  unidades: number;
  ingresos: number;
}

export interface InstitutionalActivityPoint {
  fecha: string;
  usuarios: number;
  prestamos: number;
  ventas: number;
  eventos: number;
}

export interface LatestLoanRow {
  id_prestamo: number;
  titulo: string;
  usuario: string;
  matricula: string | null;
  estado: string;
  fecha_prestamo: string;
  fecha_vencimiento: string;
  fecha_devolucion: string | null;
}

export interface LatestSaleRow {
  id_compra: number;
  usuario: string | null;
  correo: string | null;
  revistas: string;
  total: number;
  estado: string;
  fecha: string;
}

export interface RecentActivityRow {
  id: string;
  tipo: string;
  descripcion: string;
  usuario: string;
  estado: string;
  fecha: string;
  monto: number | null;
}
