import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AboutService, AboutItem } from '../../api/services/about.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css'],
})
export class AboutComponent implements OnInit {

  cargando = true;

  mision?: AboutItem;
  vision?: AboutItem;
  valores: AboutItem[] = []; 

  constructor(private aboutService: AboutService) {}

  ngOnInit(): void {
    this.aboutService.getAllPublic().subscribe({
      next: (data: AboutItem[]) => {
        this.mision  = data.find(i => i.type === 'MISION');
        this.vision  = data.find(i => i.type === 'VISION');
        this.valores = data.filter(i => i.type === 'VALORES'); // 👈 CLAVE
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
      }
    });
  }
}

