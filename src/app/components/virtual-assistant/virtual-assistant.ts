import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  VirtualAssistantAction,
  VirtualAssistantIntent,
  VirtualAssistantSection,
  VirtualAssistantSectionItem,
  VirtualAssistantService,
  VirtualAssistantSuggestion,
} from '../../api/services/virtual-assistant.service';

type ChatSender = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  sender: ChatSender;
  text: string;
  time: string;
  intent?: VirtualAssistantIntent;
  sections?: VirtualAssistantSection[];
  actions?: VirtualAssistantAction[];
  suggestions?: VirtualAssistantSuggestion[];
}

@Component({
  selector: 'app-virtual-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './virtual-assistant.html',
  styleUrl: './virtual-assistant.css',
})
export class VirtualAssistantComponent implements OnInit, OnDestroy {
  @ViewChild('messagesPane') private messagesPane?: ElementRef<HTMLDivElement>;

  isOpen = false;
  isLoading = false;
  draft = '';
  messages: ChatMessage[] = [];
  starterPrompts: string[] = [
    'Quiero buscar un libro',
    '¿Cómo pido un préstamo?',
    '¿Qué eventos hay?',
    'Quiero hablar con alguien',
  ];

  private readonly isBrowser: boolean;
  private readonly storageKey = 'tiozihuatlVirtualAssistantHistory';
  private readonly sessionKey = 'tiozihuatlVirtualAssistantSession';
  private readonly maxHistory = 18;
  private sessionId = '';
  private currentPath = '/inicio';
  private subscriptions = new Subscription();

  constructor(
    private readonly assistantService: VirtualAssistantService,
    private readonly router: Router,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.sessionId = this.getOrCreateSessionId();
    this.currentPath = this.router.url || '/inicio';
    this.loadHistory();
    this.loadTopics();

    this.subscriptions.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => {
          this.currentPath = event.urlAfterRedirects;
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  toggleAssistant(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.scheduleScroll();
  }

  closeAssistant(): void {
    this.isOpen = false;
  }

  handleEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return;
    keyboardEvent.preventDefault();
    this.sendMessage();
  }

  sendPrompt(prompt: string): void {
    this.sendMessage(prompt);
  }

  sendMessage(value = this.draft): void {
    const message = value.trim();
    if (!message || this.isLoading) return;

    this.pushMessage({
      sender: 'user',
      text: message,
    });

    this.draft = '';
    this.isLoading = true;

    this.assistantService.sendMessage(message, this.buildContext()).subscribe({
      next: (response) => {
        this.pushMessage({
          sender: 'assistant',
          text: response.reply,
          intent: response.intent,
          sections: response.sections,
          actions: response.actions,
          suggestions: response.suggestions,
        });
        this.isLoading = false;
      },
      error: () => {
        this.pushMessage({
          sender: 'assistant',
          text:
            'Parece que no pude conectarme en este momento. ¿Intentamos otra vez? Si lo prefieres, también puedo llevarte a Contacto para que recibas atención directa.',
          actions: [
            { label: 'Contacto', route: '/contactanos', icon: 'ph-envelope' },
            { label: 'Inicio', route: '/inicio', icon: 'ph-house' },
          ],
          suggestions: [
            { label: 'Biblioteca', prompt: 'Ayuda con biblioteca' },
            { label: 'Cuenta', prompt: 'Ayuda con mi cuenta' },
          ],
        });
        this.isLoading = false;
      },
    });
  }

  runAction(action: VirtualAssistantAction): void {
    if (action.route) {
      void this.router.navigateByUrl(action.route);
      this.isOpen = true;
      return;
    }

    if (action.href && this.isBrowser) {
      window.open(action.href, '_blank', 'noopener,noreferrer');
    }
  }

  runSectionItem(item: VirtualAssistantSectionItem): void {
    if (item.route) {
      void this.router.navigateByUrl(item.route);
      return;
    }

    if (item.href && this.isBrowser) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    }
  }

  clearHistory(): void {
    this.messages = [];
    this.seedWelcomeMessage();
    this.persistHistory();
  }

  getParagraphs(text: string): string[] {
    return text
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  trackByMessage(_: number, item: ChatMessage): string {
    return item.id;
  }

  trackByLabel(_: number, item: VirtualAssistantAction | VirtualAssistantSuggestion): string {
    return item.label;
  }

  trackBySection(_: number, item: VirtualAssistantSection): string {
    return item.title;
  }

  trackBySectionItem(index: number, item: VirtualAssistantSectionItem): string {
    return `${item.title}-${index}`;
  }

  private loadTopics(): void {
    this.assistantService.getTopics().subscribe({
      next: (topics) => {
        if (topics.starters?.length) {
          this.starterPrompts = topics.starters.slice(0, 6);
        }
      },
      error: () => {
        /* El asistente conserva prompts locales si el endpoint no responde. */
      },
    });
  }

  private buildContext() {
    return {
      sessionId: this.sessionId,
      path: this.currentPath,
      role: this.getStoredRole(),
      isAuthenticated: this.isAuthenticated(),
      history: this.messages.slice(-8).map((message) => ({
        sender: message.sender,
        text: message.text.slice(0, 300),
        intentId: message.intent?.id,
      })),
    };
  }

  private pushMessage(input: Omit<ChatMessage, 'id' | 'time'>): void {
    this.messages = [
      ...this.messages,
      {
        ...input,
        id: this.createId('msg'),
        time: this.formatTime(),
      },
    ].slice(-this.maxHistory);

    this.persistHistory();
    this.scheduleScroll();
  }

  private seedWelcomeMessage(): void {
    this.messages = [
      {
        id: this.createId('welcome'),
        sender: 'assistant',
        text:
          '¡Hola! Soy el asistente de Tiozihuatl. Cuéntame qué necesitas y te ayudo paso a paso. Puedo buscar libros y recursos, explicarte préstamos, orientarte con tu cuenta o llevarte a la sección correcta.',
        time: this.formatTime(),
        actions: [
          { label: 'Biblioteca', route: '/catalogo', icon: 'ph-book-bookmark' },
          { label: 'Contacto', route: '/contactanos', icon: 'ph-envelope' },
        ],
        suggestions: this.starterPrompts.slice(0, 4).map((prompt) => ({ label: prompt, prompt })),
      },
    ];
  }

  private loadHistory(): void {
    if (!this.isBrowser) {
      this.seedWelcomeMessage();
      return;
    }

    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
      this.messages = Array.isArray(parsed) ? parsed.slice(-this.maxHistory) : [];
    } catch {
      this.messages = [];
    }

    if (!this.messages.length) {
      this.seedWelcomeMessage();
    }
  }

  private persistHistory(): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.storageKey, JSON.stringify(this.messages.slice(-this.maxHistory)));
  }

  private scheduleScroll(): void {
    if (!this.isBrowser) return;

    setTimeout(() => {
      const element = this.messagesPane?.nativeElement;
      if (!element) return;
      element.scrollTop = element.scrollHeight;
    }, 40);
  }

  private getOrCreateSessionId(): string {
    if (!this.isBrowser) return this.createId('server-session');

    const existing = localStorage.getItem(this.sessionKey);
    if (existing) return existing;

    const created = this.createId('session');
    localStorage.setItem(this.sessionKey, created);
    return created;
  }

  private createId(prefix: string): string {
    if (this.isBrowser && window.crypto?.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private formatTime(): string {
    const date = new Date();
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private isAuthenticated(): boolean {
    if (!this.isBrowser) return false;
    return Boolean(
      localStorage.getItem('accessToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('refreshToken')
    );
  }

  private getStoredRole(): string | null {
    if (!this.isBrowser) return null;

    for (const key of ['user', 'userData', 'usuario']) {
      try {
        const value = localStorage.getItem(key);
        if (!value) continue;
        const parsed = JSON.parse(value) as { rol?: string; role?: string };
        if (parsed.rol || parsed.role) return parsed.rol || parsed.role || null;
      } catch {
        continue;
      }
    }

    return null;
  }
}
