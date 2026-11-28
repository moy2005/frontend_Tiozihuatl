import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-hero',
  template: `
    <header class="page-hero">
      <div class="page-hero-content">
        <h1>{{ title() }}</h1>
        <p>{{ description() }}</p>
      </div>
    </header>
  `,
  styleUrl: './page-hero.css',
})
export class PageHero {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
