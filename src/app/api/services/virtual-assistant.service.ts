import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_URL } from '../api.config';

export interface VirtualAssistantContext {
  sessionId: string;
  path: string;
  role?: string | null;
  isAuthenticated: boolean;
  history?: Array<{
    sender: 'assistant' | 'user';
    text: string;
    intentId?: string;
  }>;
}

export interface VirtualAssistantAction {
  label: string;
  route?: string;
  href?: string;
  icon?: string;
}

export interface VirtualAssistantSuggestion {
  label: string;
  prompt: string;
}

export interface VirtualAssistantSectionItem {
  title: string;
  text?: string;
  route?: string;
  href?: string | null;
  meta?: string;
}

export interface VirtualAssistantSection {
  title: string;
  items: VirtualAssistantSectionItem[];
}

export interface VirtualAssistantRelated {
  type: string;
  title: string;
  description: string;
  route?: string;
  meta?: string;
}

export interface VirtualAssistantIntent {
  id: string;
  title: string;
  category: string;
  confidence: number;
  matches: string[];
  alternatives: Array<{
    id: string;
    title: string;
    category: string;
    score: number;
  }>;
}

export interface VirtualAssistantMessageData {
  sessionId: string | null;
  intent: VirtualAssistantIntent;
  reply: string;
  sections: VirtualAssistantSection[];
  actions: VirtualAssistantAction[];
  suggestions: VirtualAssistantSuggestion[];
  related: VirtualAssistantRelated[];
  meta: {
    searchTerm?: string;
    deterministic: boolean;
    source: string;
  };
}

export interface VirtualAssistantTopics {
  starters: string[];
  categories: Record<
    string,
    Array<{
      id: string;
      title: string;
      suggestions: VirtualAssistantSuggestion[];
    }>
  >;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class VirtualAssistantService {
  private readonly api = `${API_URL}/assistant`;

  constructor(private readonly http: HttpClient) {}

  sendMessage(message: string, context: VirtualAssistantContext): Observable<VirtualAssistantMessageData> {
    return this.http
      .post<ApiResponse<VirtualAssistantMessageData>>(`${this.api}/message`, {
        message,
        context,
      })
      .pipe(map((response) => response.data));
  }

  getTopics(): Observable<VirtualAssistantTopics> {
    return this.http
      .get<ApiResponse<VirtualAssistantTopics>>(`${this.api}/topics`)
      .pipe(map((response) => response.data));
  }
}
