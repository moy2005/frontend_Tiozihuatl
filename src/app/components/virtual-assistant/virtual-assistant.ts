import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  Inject,
  Injector,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  afterNextRender,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import {
  VirtualAssistantAction,
  VirtualAssistantIntent,
  VirtualAssistantMemory,
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
  memory?: VirtualAssistantMemory;
}

/** Cómo colocar la conversación después de un cambio. */
type ScrollTarget = 'end' | 'latest';

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
  isExpanded = false;
  isLoading = false;
  isHeaderRobotAnimating = true;
  draft = '';
  messages: ChatMessage[] = [];
  starterPrompts: string[] = [
    'Busco un libro de anatomía',
    '¿Cómo pido un préstamo?',
    '¿Qué eventos hay?',
    '¿Dónde encuentro materiales de mi clase?',
  ];

  private readonly isBrowser: boolean;
  private readonly storageKey = 'tiozihuatlVirtualAssistantHistory';
  private readonly sessionKey = 'tiozihuatlVirtualAssistantSession';
  private readonly maxHistory = 18;
  private readonly welcomeText =
    '¡Hola! Soy el asistente virtual del Instituto de Estudios Superiores Tiozihuatl. Puedo buscar libros y materiales, orientarte sobre préstamos, eventos y fechas escolares, o ayudarte con tu cuenta. ¿Qué necesitas?';
  private readonly welcomeActions: VirtualAssistantAction[] = [
    { label: 'Biblioteca', route: '/catalogo', icon: 'ph-book-bookmark' },
    { label: 'Materiales', route: '/materiales', icon: 'ph-folder-open' },
  ];
  private sessionId = '';
  private currentPath = '/inicio';
  private subscriptions = new Subscription();

  constructor(
    private readonly assistantService: VirtualAssistantService,
    private readonly router: Router,
    private readonly injector: Injector,
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
    if (this.isOpen) {
      this.replayHeaderRobotAnimation();
      this.scheduleScroll('latest', false);
    }
  }

  /** Oculta el panel pero conserva toda la conversación guardada. */
  minimizeAssistant(): void {
    this.isOpen = false;
  }

  /** Agranda o reduce el panel. Solo tiene efecto visual en pantallas grandes. */
  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
  }

  replayHeaderRobotAnimation(): void {
    this.isHeaderRobotAnimating = false;
    setTimeout(() => {
      this.isHeaderRobotAnimating = true;
    });
  }

  finishHeaderRobotAnimation(): void {
    this.isHeaderRobotAnimating = false;
  }

  /** Cierra el panel y elimina por completo la conversación actual. */
  endConversation(): void {
    this.clearHistory();
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
          memory: {
            searchType: response.meta?.searchType ?? null,
            searchTerms: response.meta?.searchTerms ?? [],
            shownIds: response.meta?.shownIds ?? [],
          },
        });
        this.isLoading = false;
      },
      error: () => {
        this.pushMessage({
          sender: 'assistant',
          text: 'No pude conectarme en este momento. Revisa tu conexión e inténtalo de nuevo en unos segundos.',
          suggestions: [{ label: 'Intentar de nuevo', prompt: message }],
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
      history: this.messages.slice(-12).map((message) => ({
        sender: message.sender,
        text: message.text.slice(0, 300),
        intentId: message.intent?.id,
        searchType: message.memory?.searchType ?? undefined,
        searchTerms: message.memory?.searchTerms,
        shownIds: message.memory?.shownIds,
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
    // Lo que escribe el usuario se ve al final; una respuesta se muestra desde su inicio.
    this.scheduleScroll(input.sender === 'user' ? 'end' : 'latest');
  }

  private seedWelcomeMessage(): void {
    this.messages = [
      {
        id: this.createId('welcome'),
        sender: 'assistant',
        text: this.welcomeText,
        time: this.formatTime(),
        actions: [...this.welcomeActions],
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

      const welcome = this.messages.find((message) => message.id.startsWith('welcome-'));
      const outdatedActions =
        welcome?.actions?.map((action) => action.route).join() !==
        this.welcomeActions.map((action) => action.route).join();
      if (welcome && (welcome.text !== this.welcomeText || welcome.suggestions?.length || outdatedActions)) {
        welcome.text = this.welcomeText;
        welcome.actions = [...this.welcomeActions];
        delete welcome.suggestions;
        this.persistHistory();
      }
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

  /**
   * Coloca la conversación tras un cambio:
   * - 'end': al final (mensajes del usuario y el indicador de escritura).
   * - 'latest': el último mensaje completo; si no cabe en el panel, se alinea
   *   su inicio arriba para leerlo desde el principio sin saltos.
   */
  private scheduleScroll(target: ScrollTarget = 'end', animate = true): void {
    if (!this.isBrowser) return;

    // Se mide después de que Angular pinte el mensaje nuevo.
    afterNextRender(() => {
      const pane = this.messagesPane?.nativeElement;
      if (!pane) return;

      const maxTop = pane.scrollHeight - pane.clientHeight;
      let top = maxTop;

      if (target === 'latest') {
        const messages = pane.querySelectorAll<HTMLElement>('.va-message');
        const latest = messages[messages.length - 1];
        if (latest) {
          const paddingTop = parseFloat(getComputedStyle(pane).paddingTop) || 0;
          const latestTop = latest.offsetTop - paddingTop;
          top = latest.offsetHeight > pane.clientHeight - paddingTop ? latestTop : maxTop;
        }
      }

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      pane.scrollTo({ top: Math.max(0, Math.min(top, maxTop)), behavior: animate && !reduceMotion ? 'smooth' : 'auto' });
    }, { injector: this.injector });
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
