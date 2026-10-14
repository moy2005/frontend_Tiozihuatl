import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { environment } from '../../../api/environments/environment';
import { PushNotificationService } from '../../../pwa/push-notification.service';

interface PushStats {
  enabled: boolean;
  total: number;
  usuarios: number;
  estudiantes: number;
  docentes: number;
  administradores: number;
}

@Component({
  selector: 'app-gestion-notificaciones',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './gestion-notificaciones.html',
  styleUrl: './gestion-notificaciones.css',
})
export class GestionNotificacionesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly push = inject(PushNotificationService);
  private readonly api = `${environment.apiUrl}/notifications`;

  readonly stats = signal<PushStats | null>(null);
  readonly enviando = signal(false);
  readonly probando = signal(false);

  form = { title: '', body: '', url: '/inicio', destino: 'todos', id_usuario: '' };

  readonly rutas = [
    { label: 'Inicio', value: '/inicio' },
    { label: 'Noticias', value: '/noticias' },
    { label: 'Eventos', value: '/eventos' },
    { label: 'Catálogo', value: '/catalogo' },
    { label: 'Revistas', value: '/magazines' },
    { label: 'Mis préstamos', value: '/my-loans' },
  ];

  ngOnInit(): void {
    void this.cargarStats();
  }

  async cargarStats(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<{ data: PushStats }>(`${this.api}/admin/stats`));
      this.stats.set(res.data);
    } catch {
      this.stats.set(null);
    }
  }

  async enviar(): Promise<void> {
    if (!this.form.title.trim() || !this.form.body.trim()) {
      void Swal.fire('Campos incompletos', 'Escribe un título y un mensaje.', 'warning');
      return;
    }
    const confirm = await Swal.fire({
      title: '¿Enviar notificación?',
      text: 'Aparecerá en la campana de la web y, en los dispositivos suscritos, como aviso del sistema.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2196F3',
    });
    if (!confirm.isConfirmed) return;

    this.enviando.set(true);
    try {
      const body = { ...this.form, id_usuario: this.form.destino === 'usuario' ? Number(this.form.id_usuario) : undefined };
      const res = await firstValueFrom(
        this.http.post<{ data: { enviadas: number; fallidas: number } }>(`${this.api}/admin/send`, body),
      );
      void Swal.fire('Enviada', `Quedó en la bandeja de la web de los destinatarios. Avisos de escritorio entregados: ${res.data.enviadas} · fallidos: ${res.data.fallidas}`, 'success');
      this.form = { ...this.form, title: '', body: '' };
      void this.cargarStats();
    } catch (error: any) {
      void Swal.fire('Error', error?.error?.message || 'No se pudo enviar la notificación.', 'error');
    } finally {
      this.enviando.set(false);
    }
  }

  async probar(): Promise<void> {
    if (this.push.state() !== 'on') await this.push.enable();
    if (this.push.state() !== 'on') return;
    this.probando.set(true);
    try {
      await this.push.sendTest();
    } catch {
      void Swal.fire('Error', 'No se pudo enviar la prueba.', 'error');
    } finally {
      this.probando.set(false);
    }
  }
}
