import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Indicador de carga común del panel de administración: tres arcos
 * concéntricos (diseño de Gestión de usuarios), compacto y sin fondo.
 */
@Component({
  selector: 'app-admin-loader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-loader" [class.adm-loader--inverse]="inverse()" role="status" aria-live="polite">
      <span class="adm-loader__ring" aria-hidden="true"></span>
      <span class="adm-loader__text">{{ texto() }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .adm-loader {
      display: grid;
      justify-items: center;
      gap: 0.85rem;
      padding: 2.5rem 1rem;
      text-align: center;
      animation: adm-loader-in 0.24s ease both;
    }

    .adm-loader__ring {
      position: relative;
      width: 3.5rem;
      height: 3.5rem;
      border-left: 3px solid #2196F3;
      border-radius: 50%;
      animation: adm-loader-spin-right 0.9s linear infinite;
    }

    .adm-loader__ring::before,
    .adm-loader__ring::after {
      content: '';
      position: absolute;
      border-radius: 50%;
    }

    .adm-loader__ring::before {
      width: 2.75rem;
      height: 2.75rem;
      top: calc(50% - 1.375rem);
      left: calc(50% - 1.375rem);
      border-right: 3px solid #4FC3F7;
      animation: adm-loader-spin-left 0.9s linear infinite;
    }

    .adm-loader__ring::after {
      width: 2rem;
      height: 2rem;
      top: calc(50% - 1rem);
      left: calc(50% - 1rem);
      border-top: 3px solid #1565C0;
    }

    .adm-loader__text {
      font-size: 0.875rem;
      font-weight: 600;
      color: #1565C0;
      letter-spacing: 0.01em;
    }

    /* Sobre fondos azules (avisos de guardado en modales). */
    .adm-loader--inverse .adm-loader__ring { border-left-color: #FFFFFF; }
    .adm-loader--inverse .adm-loader__ring::before { border-right-color: rgba(255, 255, 255, 0.75); }
    .adm-loader--inverse .adm-loader__ring::after { border-top-color: rgba(255, 255, 255, 0.5); }
    .adm-loader--inverse .adm-loader__text { color: #FFFFFF; }

    @keyframes adm-loader-spin-right { to { transform: rotate(360deg); } }
    @keyframes adm-loader-spin-left { from { transform: rotate(720deg); } to { transform: rotate(0deg); } }
    @keyframes adm-loader-in { from { opacity: 0; } }

    @media (prefers-reduced-motion: reduce) {
      .adm-loader__ring,
      .adm-loader__ring::before { animation-duration: 2.4s; }
    }
  `],
})
export class AdminLoaderComponent {
  readonly texto = input('Cargando...');
  readonly inverse = input(false);
}
